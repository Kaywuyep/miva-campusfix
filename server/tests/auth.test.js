const { app, request, startDb, stopDb, login } = require("./setup");

beforeAll(startDb);
afterAll(stopDb);

describe("Authentication API", () => {
  test("registers a new Student/Staff user and returns a JWT", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test Student",
      email: "new.student@codespirefix.edu",
      password: "Secret123",
      department: "Physics",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role.name).toBe("user");
    expect(res.body.user.password).toBeUndefined(); // hash never leaves the server
  });

  test("rejects a duplicate email with 409", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Dup",
      email: "student@codespirefix.edu",
      password: "Secret123",
    });
    expect(res.status).toBe(409);
  });

  test("validates registration input with 422 and field errors", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "", email: "bad", password: "short" });
    expect(res.status).toBe(422);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining(["name", "email", "password"]),
    );
  });

  test("logs in with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@codespirefix.edu", password: "Password123" });
    expect(res.status).toBe(200);
    expect(res.body.user.role.name).toBe("admin");
  });

  test("refuses a wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@codespirefix.edu", password: "wrongpass1" });
    expect(res.status).toBe(401);
  });

  test("GET /me requires a valid token", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/auth/me")
          .set("Authorization", "Bearer not-a-token")
      ).status,
    ).toBe(401);

    const token = await login("student@codespirefix.edu");
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("student@codespirefix.edu");
  });

  test("a deactivated account cannot log in", async () => {
    const admin = await login("admin@codespirefix.edu");
    const list = await request(app)
      .get("/api/users?q=staff@")
      .set("Authorization", `Bearer ${admin}`);
    const staffId = list.body.data[0]._id;
    await request(app)
      .put(`/api/users/${staffId}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ isActive: false });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "staff@codespirefix.edu", password: "Password123" });
    expect(res.status).toBe(403);
  });
});
