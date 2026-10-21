const path = require("path");
const fs = require("fs");
const { app, request, startDb, stopDb, login } = require("./setup");

let student, officer, plumber, admin, categoryId, newId, officerId;
const auth = (t) => ({ Authorization: `Bearer ${t}` });
// Data rows of an exported CSV (everything after the branded heading and column header)
const csvRows = (text) => {
  const lines = text.split("\n");
  return lines.slice(lines.findIndex((l) => l.startsWith('"Ticket"')) + 1);
};

beforeAll(async () => {
  await startDb();
  [student, officer, plumber, admin] = await Promise.all([
    login("student@codespirefix.edu"),
    login("officer@codespirefix.edu"),
    login("plumber@codespirefix.edu"),
    login("admin@codespirefix.edu"),
  ]);
  const cats = await request(app).get("/api/categories").set(auth(student));
  categoryId = cats.body.data.find((c) => c.name === "Electrical")._id;
  const officers = await request(app)
    .get("/api/users/officers")
    .set(auth(admin));
  officerId = officers.body.data.find(
    (o) => o.email === "officer@codespirefix.edu",
  )._id;
});
afterAll(stopDb);

describe("Service request CRUD", () => {
  test("student submits a request with an evidence photo", async () => {
    const img = path.join(__dirname, "fixture.png");
    fs.writeFileSync(
      img,
      Buffer.from(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA6300010000050021A5F645400000000049454E44AE426082",
        "hex",
      ),
    );

    const res = await request(app)
      .post("/api/requests")
      .set(auth(student))
      .field("title", "Bulb blown in corridor")
      .field(
        "description",
        "The corridor light outside room 210 has been off for two days.",
      )
      .field("category", categoryId)
      .field("location", "Hostel B, 2nd floor corridor")
      .field("priority", "medium")
      .attach("attachments", img);

    expect(res.status).toBe(201);
    expect(res.body.data.ticketNo).toMatch(/^REQ-\d{4}-\d{5}$/);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.attachments).toHaveLength(1);
    newId = res.body.data._id;
    fs.unlinkSync(img);
  });

  test("rejects an invalid request with 422", async () => {
    const res = await request(app)
      .post("/api/requests")
      .set(auth(student))
      .send({ title: "x", category: "nope" });
    expect(res.status).toBe(422);
  });

  test("officers cannot submit requests (RBAC → 403)", async () => {
    const res = await request(app)
      .post("/api/requests")
      .set(auth(officer))
      .send({});
    expect(res.status).toBe(403);
  });

  test("student sees only their own requests, with pagination info", async () => {
    const res = await request(app)
      .get("/api/requests?limit=2")
      .set(auth(student));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination.total).toBe(4); // 3 seeded + 1 created above
    res.body.data.forEach((r) =>
      expect(r.requester.email).toBe("student@codespirefix.edu"),
    );
  });

  test("search and filter narrow the results", async () => {
    const res = await request(app)
      .get("/api/requests?q=corridor&status=pending")
      .set(auth(student));
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]._id).toBe(newId);
  });

  test("owner can edit while pending", async () => {
    const res = await request(app)
      .put(`/api/requests/${newId}`)
      .set(auth(student))
      .send({ priority: "high" });
    expect(res.status).toBe(200);
    expect(res.body.data.priority).toBe("high");
  });

  test("another officer cannot read a request not assigned to them", async () => {
    const res = await request(app)
      .get(`/api/requests/${newId}`)
      .set(auth(plumber));
    expect(res.status).toBe(403);
  });
});

describe("Assignment and status workflow", () => {
  test("only admin can assign", async () => {
    const res = await request(app)
      .patch(`/api/requests/${newId}/assign`)
      .set(auth(student))
      .send({ officerId });
    expect(res.status).toBe(403);
  });

  test("admin assigns the request to an officer", async () => {
    const res = await request(app)
      .patch(`/api/requests/${newId}/assign`)
      .set(auth(admin))
      .send({ officerId, note: "Urgent" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("assigned");
    expect(res.body.data.assignedTo._id).toBe(officerId);
  });

  test("officer sees the job and marks it in progress then completed", async () => {
    const list = await request(app).get("/api/requests").set(auth(officer));
    expect(list.body.data.some((r) => r._id === newId)).toBe(true);

    let res = await request(app)
      .patch(`/api/requests/${newId}/status`)
      .set(auth(officer))
      .send({ status: "in_progress", comment: "On my way" });
    expect(res.status).toBe(200);
    res = await request(app)
      .patch(`/api/requests/${newId}/status`)
      .set(auth(officer))
      .send({ status: "completed", comment: "Bulb replaced" });
    expect(res.status).toBe(200);
    expect(res.body.data.completedAt).toBeDefined();
  });

  test("officer cannot cancel a job", async () => {
    const res = await request(app)
      .patch(`/api/requests/${newId}/status`)
      .set(auth(officer))
      .send({ status: "cancelled" });
    expect([400, 403]).toContain(res.status);
  });

  test("timeline records every status change", async () => {
    const res = await request(app)
      .get(`/api/requests/${newId}`)
      .set(auth(student));
    expect(res.body.data.timeline.map((t) => t.toStatus)).toEqual([
      "pending",
      "assigned",
      "in_progress",
      "completed",
    ]);
  });

  test("requester was notified", async () => {
    const res = await request(app).get("/api/notifications").set(auth(student));
    expect(res.body.data.some((n) => /completed/.test(n.message))).toBe(true);
  });
});

describe("Admin reports, export and audit log", () => {
  test("summary counts by status and category", async () => {
    const res = await request(app).get("/api/reports/summary").set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(7);
    expect(res.body.data.byStatus.completed).toBe(2);
  });

  test("CSV export returns a file", async () => {
    const res = await request(app)
      .get("/api/reports/export?status=completed")
      .set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("codespireFix - Service Requests Report");
    expect(res.text).toContain('"Filters","Status: completed"');
    expect(csvRows(res.text)).toHaveLength(2);
  });

  test("summary is limited to the report filters", async () => {
    const res = await request(app)
      .get("/api/reports/summary?status=completed")
      .set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.byStatus.pending).toBe(0);
    expect(res.body.data.byPriority).toBeDefined();
  });

  test("report date range includes the whole end day", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const all = await request(app)
      .get(`/api/reports/summary?from=${today}&to=${today}`)
      .set(auth(admin));
    expect(all.body.data.total).toBeGreaterThan(0); // the request submitted above
    const past = await request(app)
      .get("/api/reports/summary?from=2000-01-01&to=2000-12-31")
      .set(auth(admin));
    expect(past.body.data.total).toBe(0);
  });

  test("report filters by officer and rejects bad input", async () => {
    const res = await request(app)
      .get(`/api/reports/export?assignedTo=${officerId}`)
      .set(auth(admin));
    expect(res.status).toBe(200);
    const summary = await request(app)
      .get(`/api/reports/summary?assignedTo=${officerId}`)
      .set(auth(admin));
    expect(summary.body.data.total).toBeGreaterThan(0);
    expect(csvRows(res.text)).toHaveLength(summary.body.data.total);
    expect(
      (await request(app).get("/api/reports/summary?from=yesterday").set(auth(admin)))
        .status,
    ).toBe(422);
  });

  test("officers cannot widen their scope with assignedTo", async () => {
    const res = await request(app)
      .get(`/api/requests?assignedTo=${officerId}`)
      .set(auth(plumber));
    expect(res.status).toBe(200);
    expect(res.body.data.every((r) => r.assignedTo?._id !== officerId)).toBe(true);
  });

  test("reports are admin-only", async () => {
    expect(
      (await request(app).get("/api/reports/summary").set(auth(student)))
        .status,
    ).toBe(403);
  });

  test("audit log captured the assignment", async () => {
    const res = await request(app)
      .get("/api/reports/audit?action=REQUEST_ASSIGNED")
      .set(auth(admin));
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test("admin deletes a request; unknown ids return 404", async () => {
    expect(
      (await request(app).delete(`/api/requests/${newId}`).set(auth(admin)))
        .status,
    ).toBe(200);
    expect(
      (await request(app).get(`/api/requests/${newId}`).set(auth(admin)))
        .status,
    ).toBe(404);
  });
});
