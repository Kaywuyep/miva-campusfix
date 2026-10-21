require("dotenv").config();
const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./utils/socket");

const PORT = process.env.PORT || 5002;

(async () => {
  if (!process.env.JWT_SECRET)
    throw new Error("JWT_SECRET is not set (see .env.example)");
  await connectDB(process.env.MONGO_URI);

  const server = http.createServer(app);
  initSocket(server, process.env.CLIENT_URL || "*");
  server.listen(PORT, () =>
    console.log(
      `codespireFix API running on http://localhost:${PORT}  (docs: /api/docs)`,
    ),
  );
})().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
