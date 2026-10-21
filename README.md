# codespireFix — University Maintenance Request System

Full-stack MERN web application (MongoDB, Express, React, Node.js) for MIT 8333 – Advanced Web Application Development.

Students and staff submit maintenance requests (electricity, furniture, plumbing, internet, classroom equipment, hostel issues) with photo evidence. Administrators assign them to maintenance officers, officers update progress, and everyone follows the request live until it is completed.

- **Live app:** https://miva-campusfix.onrender.com/
- **API docs:** https://miva-campusfix.onrender.com/api/docs/
- **Repository:** https://github.com/Kaywuyep/miva-campusfix

## Features

| Requirement                                           | Where                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| Registration & login                                  | `client/src/pages/Login.jsx`, `Register.jsx`, `server/src/routes/auth.js`        |
| Role-based dashboards (Student/Staff, Officer, Admin) | `client/src/pages/Dashboard.jsx`, `components/Layout.jsx`                        |
| Request form, tracking page, admin management         | `NewRequest.jsx`, `RequestDetail.jsx`, `Requests.jsx`, `pages/admin/*`           |
| JWT authentication + bcrypt password hashing          | `server/src/middleware/auth.js`, `models/User.js`                                |
| Role-based access control (API + UI)                  | `authorize()` middleware, `ProtectedRoute.jsx`                                   |
| File/image upload (evidence)                          | `server/src/middleware/upload.js` (Multer)                                       |
| In-app notifications                                  | `routes/notifications.js`, bell in `Layout.jsx`                                  |
| Real-time status updates                              | Socket.IO — `server/src/utils/socket.js`, `client/src/context/SocketContext.jsx` |
| Search, filter, pagination                            | `GET /api/requests?q=&status=&category=&priority=&page=`                         |
| Audit trail / activity log                            | `models/AuditLog.js`, `GET /api/reports/audit`                                   |
| API documentation (Swagger)                           | `/api/docs`                                                                      |
| CSV export                                            | `GET /api/reports/export`                                                        |
| Requester feedback (rate a completed repair)          | `components/Feedback.jsx`, `POST /api/requests/:id/feedback`                     |
| Report generator (filters → modal → CSV / PDF)        | `pages/admin/Reports.jsx`, `components/Modal.jsx`, `GET /api/reports/summary`    |
| Branding (logo, favicon, watermark)                   | `client/public/brand/`, `components/Logo.jsx`                                    |

## Run it locally

You need **Node.js 18+** and **MongoDB** (install MongoDB Community Server locally, or create a free cluster on MongoDB Atlas).

```bash
# 1. Backend
cd server
cp .env.example .env          # then edit MONGO_URI and JWT_SECRET
# 1. Install the packages for both the server and the React app
npm run install:all
# npm install
npm run seed                  # roles, categories and demo accounts
npm run dev                   # API on http://localhost:5002  (docs: /api/docs)

# 2. Frontend (new terminal)
cd client
npm install
npm run dev                   # app on http://localhost:5173
```

### Demo accounts (password `Password123`)

| Role                | Email                                              |
| ------------------- | -------------------------------------------------- |
| Administrator       | admin@codespirefix.edu                             |
| Maintenance Officer | officer@codespirefix.edu, plumber@codespirefix.edu |
| Student / Staff     | student@codespirefix.edu, staff@codespirefix.edu   |

## Tests

```bash
cd server && npm test   # 33 API tests (Jest + Supertest) — needs MongoDB running
cd client && npm test   # 22 component tests (Vitest + React Testing Library)
```

The API tests use a separate database (`codespireFix_test`, or set `MONGO_URI_TEST`) and drop it when finished.

## Deploy (MongoDB Atlas + Render)

1. **Database:** create a free M0 cluster on MongoDB Atlas → Database Access: add a user → Network Access: allow `0.0.0.0/0` → copy the connection string and add `/codespireFix` before the `?`.
2. **Code:** push this folder to a GitHub repository.
3. **Render:** New → Blueprint → pick the repo (uses `render.yaml`), or New → Web Service with
   - Build command: `npm run build`
   - Start command: `npm start`
   - Environment: `NODE_ENV=production`, `MONGO_URI=<Atlas string>`, `JWT_SECRET=<long random string>`
4. After the first deploy, open the Render **Shell** and run `npm run seed` once.
5. Check `https://miva-campusfix.onrender.com/api/health` — it should say `"database": "connected"`.

Express serves the React build in production, so the whole app runs at one URL. Note: Render's free disk is temporary, so uploaded photos are lost on redeploy; for permanent storage switch Multer to Cloudinary or S3.
