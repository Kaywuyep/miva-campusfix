// Shared helpers: connect to a throw-away test database and log in demo users
require("dotenv").config();
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const { run } = require("../src/seed");

const TEST_URI =
  process.env.MONGO_URI_TEST || "mongodb://127.0.0.1:27017/codespireFix_test";

async function startDb() {
  // The MongoDB driver loads `os` with a dynamic import(), which Jest's module sandbox
  // rejects; the handshake then goes out without client metadata and the server refuses it.
  // Handing the driver the module directly avoids the import.
  await mongoose.connect(TEST_URI, { runtimeAdapters: { os: require("os") } });
  await run({ withDemo: true }); // fresh roles, categories, demo users, sample requests
}

async function stopDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

async function login(email, password = "Password123") {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  return res.body.token;
}

module.exports = { app, request, startDb, stopDb, login };
