// Populates the database with roles, categories, demo accounts and sample requests.
// Run with:  npm run seed
require("dotenv").config();
const mongoose = require("mongoose");
const Role = require("./models/Role");
const User = require("./models/User");
const Category = require("./models/Category");
const ServiceRequest = require("./models/ServiceRequest");
const Assignment = require("./models/Assignment");
const StatusLog = require("./models/StatusLog");
const Notification = require("./models/Notification");
const AuditLog = require("./models/AuditLog");

const ROLES = [
  {
    name: "user",
    label: "Student/Staff",
    permissions: ["request:create", "request:read:own", "request:cancel:own"],
  },
  {
    name: "officer",
    label: "Maintenance Officer",
    permissions: ["request:read:assigned", "request:update-status"],
  },
  { name: "admin", label: "Administrator", permissions: ["*"] },
];

const CATEGORIES = [
  ["Electrical", "Faulty sockets, lights, fans, power outages"],
  ["Furniture", "Broken chairs, tables, beds, wardrobes"],
  ["Plumbing", "Leaking pipes, blocked drains, toilets, taps"],
  ["Internet & Network", "Wi-Fi outages, LAN ports, slow connection"],
  ["Classroom Equipment", "Projectors, smart boards, PA systems, ACs"],
  ["Hostel Maintenance", "Doors, windows, locks, painting, pests"],
];

async function seedReference() {
  for (const r of ROLES)
    await Role.updateOne({ name: r.name }, r, { upsert: true });
  for (const [name, description] of CATEGORIES)
    await Category.updateOne({ name }, { name, description }, { upsert: true });
}

async function run({ withDemo = true } = {}) {
  await seedReference();
  if (!withDemo) return;

  await Promise.all(
    [User, ServiceRequest, Assignment, StatusLog, Notification, AuditLog].map(
      (m) => m.deleteMany({}),
    ),
  );
  const roles = Object.fromEntries(
    (await Role.find()).map((r) => [r.name, r._id]),
  );
  const cats = Object.fromEntries(
    (await Category.find()).map((c) => [c.name, c._id]),
  );

  const mk = (name, email, role, department) =>
    User.create({
      name,
      email,
      password: "Password123",
      role: roles[role],
      department,
    });
  const admin = await mk(
    "Catherine Wuyep",
    "admin@codespirefix.edu",
    "admin",
    "Works & Services",
  );
  const officer1 = await mk(
    "Fiki Ibrahim",
    "officer@codespirefix.edu",
    "officer",
    "Electrical Unit",
  );
  const officer2 = await mk(
    "Chinedu Okafor",
    "plumber@codespirefix.edu",
    "officer",
    "Plumbing Unit",
  );
  const officer3 = await mk(
    "Melody Ade",
    "networkunit@codespirefix.edu",
    "officer",
    "ICT Unit",
  );
  const student = await mk(
    "Josh Adamu",
    "student@codespirefix.edu",
    "user",
    "Computer Science",
  );
  const staff = await mk(
    "Dr. Tunde Bello",
    "staff@codespirefix.edu",
    "user",
    "Information Technology",
  );

  // [requester, category, title, description, location, priority, status, officer, daysAgo]
  const samples = [
    [
      student,
      "Electrical",
      "Sockets not working in room",
      "None of the wall sockets in my room are working since yesterday evening.",
      "Hostel B, Room 214",
      "high",
      "in_progress",
      officer1,
      6,
    ],
    [
      student,
      "Plumbing",
      "Leaking pipe in bathroom",
      "Water is leaking from the pipe under the sink and flooding the floor.",
      "Hostel B, Block 2 Bathroom",
      "urgent",
      "assigned",
      officer2,
      2,
    ],
    [
      staff,
      "Classroom Equipment",
      "Projector not displaying",
      "The projector in LT 3 powers on but shows no input from the HDMI cable.",
      "Lecture Theatre 3",
      "medium",
      "completed",
      officer1,
      9,
    ],
    [
      staff,
      "Internet & Network",
      "No Wi-Fi in staff office",
      "The Wi-Fi network is not visible in the IT department offices on floor 2.",
      "ICT Building, Floor 2",
      "high",
      "assigned",
      officer3,
      1,
    ],
    [
      student,
      "Furniture",
      "Broken reading chair",
      "One of the chairs in the library reading area has a broken leg.",
      "Main Library, Reading Room A",
      "low",
      "pending",
      null,
      3,
    ],
    [
      staff,
      "Hostel Maintenance",
      "Door lock jammed",
      "The door lock to the staff quarters store room is jammed.",
      "Staff Quarters, Block C",
      "medium",
      "cancelled",
      null,
      12,
    ],
  ];

  for (const [
    who,
    cat,
    title,
    description,
    location,
    priority,
    status,
    officer,
    daysAgo,
  ] of samples) {
    const createdAt = new Date(Date.now() - daysAgo * 86400e3);
    const req = await ServiceRequest.create({
      title,
      description,
      location,
      priority,
      category: cats[cat],
      requester: who._id,
      status,
      assignedTo: officer ? officer._id : null,
      completedAt:
        status === "completed"
          ? new Date(createdAt.getTime() + 26 * 3600e3)
          : undefined,
      // completed samples come with the requester's rating
      feedback:
        status === "completed"
          ? {
              rating: 4,
              resolved: true,
              comment: "Working again — thanks for the quick visit.",
              submittedAt: new Date(createdAt.getTime() + 30 * 3600e3),
            }
          : undefined,
    });
    // back-date the sample so dashboards show realistic dates and fix times
    await ServiceRequest.collection.updateOne(
      { _id: req._id },
      { $set: { createdAt } },
    );
    await StatusLog.create({
      request: req._id,
      toStatus: "pending",
      comment: "Request submitted",
      changedBy: who._id,
    });
    if (officer) {
      await Assignment.create({
        request: req._id,
        officer: officer._id,
        assignedBy: admin._id,
        note: "Please attend promptly",
      });
      await StatusLog.create({
        request: req._id,
        fromStatus: "pending",
        toStatus: "assigned",
        comment: `Assigned to ${officer.name}`,
        changedBy: admin._id,
      });
      await Notification.create({
        user: officer._id,
        message: `New job assigned: ${req.ticketNo} — ${title}`,
        request: req._id,
      });
    }
    if (["in_progress", "completed"].includes(status)) {
      await StatusLog.create({
        request: req._id,
        fromStatus: "assigned",
        toStatus: "in_progress",
        comment: "Inspected — working on it",
        changedBy: officer._id,
      });
    }
    if (status === "completed") {
      await StatusLog.create({
        request: req._id,
        fromStatus: "in_progress",
        toStatus: "completed",
        comment: "Replaced faulty HDMI switch",
        changedBy: officer._id,
      });
      await Notification.create({
        user: who._id,
        message: `Your request ${req.ticketNo} is now completed`,
        request: req._id,
      });
    }
    if (status === "cancelled") {
      await StatusLog.create({
        request: req._id,
        fromStatus: "pending",
        toStatus: "cancelled",
        comment: "Resolved on my own",
        changedBy: who._id,
      });
    }
    await AuditLog.create({
      actor: who._id,
      action: "REQUEST_CREATED",
      entity: "ServiceRequest",
      entityId: req._id,
      details: req.ticketNo,
    });
  }
  await Notification.create({
    user: student._id,
    message: "Your request has been assigned to an officer",
    read: false,
  });
}

module.exports = { run, seedReference };

if (require.main === module) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => run())
    .then(() => {
      console.log("Seed complete. Demo logins (password: Password123):");
      console.log(
        "  admin@codespirefix.edu | officer@codespirefix.edu | plumber@codespirefix.edu | student@codespirefix.edu | staff@codespirefix.edu",
      );
      return mongoose.disconnect();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
