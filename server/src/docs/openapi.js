// OpenAPI 3 specification — served as interactive Swagger UI at /api/docs
const bearer = [{ bearerAuth: [] }];
const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
};
const ok = (description) => ({ description });
// Filters shared by the report summary and CSV export
const reportParams = [
  { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Submitted on or after (YYYY-MM-DD)" },
  { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "Submitted on or before (YYYY-MM-DD)" },
  ...["status", "category", "priority", "assignedTo"].map((n) => ({ name: n, in: "query", schema: { type: "string" } })),
];
const json = (schema) => ({
  required: true,
  content: { "application/json": { schema } },
});

module.exports = {
  openapi: "3.0.3",
  info: {
    title: "codespireFix — University Maintenance Request API",
    version: "1.0.0",
    description:
      "REST API for submitting, assigning and tracking university maintenance requests. " +
      'Log in with POST /api/auth/login, copy the token, click "Authorize" and paste it.',
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Credentials: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", example: "student@codespirefix.edu" },
          password: { type: "string", example: "Password123" },
        },
      },
      Register: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "Ada Obi" },
          email: { type: "string", example: "ada@codespirefix.edu" },
          password: { type: "string", example: "Password123" },
          department: { type: "string", example: "Computer Science" },
          phone: { type: "string", example: "08030000000" },
        },
      },
      ServiceRequestInput: {
        type: "object",
        required: ["title", "description", "category", "location"],
        properties: {
          title: { type: "string", example: "Ceiling fan not working" },
          description: {
            type: "string",
            example:
              "The fan in Lecture Hall 2 makes noise and stops after a few minutes.",
          },
          category: { type: "string", description: "Category ObjectId" },
          location: { type: "string", example: "Lecture Hall 2" },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
          },
          attachments: {
            type: "array",
            items: { type: "string", format: "binary" },
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string" },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: "Auth" },
    { name: "Service Requests" },
    { name: "Users (Admin)" },
    { name: "Categories" },
    { name: "Notifications" },
    { name: "Reports (Admin)" },
  ],
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a Student/Staff account",
        requestBody: json({ $ref: "#/components/schemas/Register" }),
        responses: {
          201: ok("Created — returns token and user"),
          409: ok("Email already registered"),
          422: ok("Validation failed"),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in and receive a JWT",
        requestBody: json({ $ref: "#/components/schemas/Credentials" }),
        responses: {
          200: ok("Token and user"),
          401: ok("Invalid email or password"),
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user",
        security: bearer,
        responses: { 200: ok("User"), 401: ok("Not authenticated") },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out (recorded in audit log)",
        security: bearer,
        responses: { 200: ok("Logged out") },
      },
    },

    "/api/requests": {
      get: {
        tags: ["Service Requests"],
        summary: "List requests (search, filter, paginate; scoped by role)",
        security: bearer,
        parameters: [
          "q",
          "status",
          "category",
          "priority",
          "page",
          "limit",
        ].map((n) => ({ name: n, in: "query", schema: { type: "string" } })),
        responses: { 200: ok("Paged list") },
      },
      post: {
        tags: ["Service Requests"],
        summary: "Submit a request (Student/Staff or Admin)",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { $ref: "#/components/schemas/ServiceRequestInput" },
            },
          },
        },
        responses: {
          201: ok("Created"),
          403: ok("Wrong role"),
          422: ok("Validation failed"),
        },
      },
    },
    "/api/requests/stats": {
      get: {
        tags: ["Service Requests"],
        summary: "Counts per status for the dashboard",
        security: bearer,
        responses: { 200: ok("Stats") },
      },
    },
    "/api/requests/{id}": {
      get: {
        tags: ["Service Requests"],
        summary: "Request detail with timeline",
        security: bearer,
        parameters: [idParam],
        responses: {
          200: ok("Request"),
          403: ok("No access"),
          404: ok("Not found"),
        },
      },
      put: {
        tags: ["Service Requests"],
        summary: "Edit (owner while pending, or admin)",
        security: bearer,
        parameters: [idParam],
        requestBody: json({
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            location: { type: "string" },
            priority: { type: "string" },
          },
        }),
        responses: { 200: ok("Updated"), 403: ok("Not allowed") },
      },
      delete: {
        tags: ["Service Requests"],
        summary: "Delete (admin)",
        security: bearer,
        parameters: [idParam],
        responses: { 200: ok("Deleted") },
      },
    },
    "/api/requests/{id}/status": {
      patch: {
        tags: ["Service Requests"],
        summary:
          "Update status (officer: in_progress/completed; owner: cancel; admin: any)",
        security: bearer,
        parameters: [idParam],
        requestBody: json({
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: [
                "pending",
                "assigned",
                "in_progress",
                "completed",
                "cancelled",
              ],
            },
            comment: { type: "string" },
          },
        }),
        responses: { 200: ok("Status changed"), 403: ok("Not allowed") },
      },
    },
    "/api/requests/{id}/assign": {
      patch: {
        tags: ["Service Requests"],
        summary: "Assign to a maintenance officer (admin)",
        security: bearer,
        parameters: [idParam],
        requestBody: json({
          type: "object",
          required: ["officerId"],
          properties: {
            officerId: { type: "string" },
            note: { type: "string" },
          },
        }),
        responses: { 200: ok("Assigned"), 422: ok("Not an officer") },
      },
    },

    "/api/users": {
      get: {
        tags: ["Users (Admin)"],
        summary: "List users",
        security: bearer,
        parameters: ["q", "role", "page", "limit"].map((n) => ({
          name: n,
          in: "query",
          schema: { type: "string" },
        })),
        responses: { 200: ok("Paged list") },
      },
      post: {
        tags: ["Users (Admin)"],
        summary: "Create a user of any role",
        security: bearer,
        requestBody: json({
          allOf: [
            { $ref: "#/components/schemas/Register" },
            {
              type: "object",
              properties: {
                role: { type: "string", enum: ["user", "officer", "admin"] },
              },
            },
          ],
        }),
        responses: { 201: ok("Created") },
      },
    },
    "/api/users/officers": {
      get: {
        tags: ["Users (Admin)"],
        summary: "Active officers with open-job counts",
        security: bearer,
        responses: { 200: ok("Officers") },
      },
    },
    "/api/users/{id}": {
      put: {
        tags: ["Users (Admin)"],
        summary: "Update user / role / active flag",
        security: bearer,
        parameters: [idParam],
        requestBody: json({
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string" },
            isActive: { type: "boolean" },
          },
        }),
        responses: { 200: ok("Updated") },
      },
      delete: {
        tags: ["Users (Admin)"],
        summary: "Delete user (only if no requests on record)",
        security: bearer,
        parameters: [idParam],
        responses: { 200: ok("Deleted"), 409: ok("Has requests") },
      },
    },

    "/api/categories": {
      get: {
        tags: ["Categories"],
        summary: "List categories",
        security: bearer,
        responses: { 200: ok("Categories") },
      },
      post: {
        tags: ["Categories"],
        summary: "Create (admin)",
        security: bearer,
        requestBody: json({
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
        }),
        responses: { 201: ok("Created") },
      },
    },
    "/api/categories/{id}": {
      put: {
        tags: ["Categories"],
        summary: "Update (admin)",
        security: bearer,
        parameters: [idParam],
        responses: { 200: ok("Updated") },
      },
      delete: {
        tags: ["Categories"],
        summary: "Delete (admin, unused only)",
        security: bearer,
        parameters: [idParam],
        responses: { 200: ok("Deleted") },
      },
    },

    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "My notifications + unread count",
        security: bearer,
        responses: { 200: ok("List") },
      },
    },
    "/api/notifications/read-all": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark all read",
        security: bearer,
        responses: { 200: ok("Done") },
      },
    },
    "/api/notifications/{id}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark one read",
        security: bearer,
        parameters: [idParam],
        responses: { 200: ok("Done") },
      },
    },

    "/api/reports/summary": {
      get: {
        tags: ["Reports (Admin)"],
        summary:
          "Generate a report: totals by status, priority, category, officer and average resolution time for the filtered requests",
        security: bearer,
        parameters: reportParams,
        responses: { 200: ok("Summary") },
      },
    },
    "/api/reports/export": {
      get: {
        tags: ["Reports (Admin)"],
        summary:
          "Export requests as CSV (accepts the same filters as the list)",
        security: bearer,
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          ...reportParams,
        ],
        responses: {
          200: { description: "CSV file", content: { "text/csv": {} } },
        },
      },
    },
    "/api/reports/audit": {
      get: {
        tags: ["Reports (Admin)"],
        summary: "Audit trail / activity log",
        security: bearer,
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "action", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: ok("Paged log") },
      },
    },
    "/api/health": {
      get: {
        tags: ["Auth"],
        summary: "Health check (API + database)",
        responses: { 200: ok("OK") },
      },
    },
  },
};
