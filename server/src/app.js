const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const swaggerUi = require("swagger-ui-express");
const openapi = require("./docs/openapi");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

// Uploaded evidence photos
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// API documentation
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openapi, { customSiteTitle: "codespireFix API Docs" }),
);
app.get("/api/docs.json", (_req, res) => res.json(openapi));

// Health check — also proves the deployed app can reach the database
app.get("/api/health", (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    success: dbUp,
    api: "up",
    database: dbUp ? "connected" : "disconnected",
    time: new Date(),
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/requests", require("./routes/requests"));
app.use("/api/users", require("./routes/users"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/reports", require("./routes/reports"));

// In production, Express also serves the built React app (one deployment)
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) =>
    res.sendFile(path.join(clientDist, "index.html")),
  );
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
