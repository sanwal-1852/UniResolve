# UniResolve — University Complaint Management System

A full-stack web application for university students to submit, track, and manage complaints. Built with **Node.js**, **Express**, **MongoDB**, and a **Bootstrap 5** frontend.

---

## Project Structure

```
uniresolve/
├── backend/                    # Node.js / Express API
│   ├── config/
│   │   ├── db.js               # MongoDB connection
│   │   └── seed.js             # Sample data seeder
│   ├── middleware/
│   │   ├── auth.js             # JWT protect + adminOnly guards
│   │   └── errorHandler.js     # Global error normaliser
│   ├── models/
│   │   ├── User.js             # Mongoose User schema
│   │   └── Complaint.js        # Mongoose Complaint schema
│   ├── routes/
│   │   ├── auth.js             # POST /register, POST /login, GET /me
│   │   └── complaints.js       # CRUD complaint endpoints
│   ├── server.js               # Express entry point
│   ├── package.json
│   └── .env.example            # Environment variable template
└── public/                     # Static frontend (served by Express)
    ├── css/
    │   └── style.css
    ├── js/
    │   └── main.js             # API-connected frontend logic
    ├── index.html
    ├── login.html
    ├── register.html
    ├── submit-complaint.html
    ├── view-complaints.html
    └── admin-dashboard.html
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18.0 | https://nodejs.org |
| npm | ≥ 9.0 (bundled with Node) | — |
| MongoDB | ≥ 6.0 (local) **or** MongoDB Atlas (cloud) | https://www.mongodb.com |

---

## Setup & Installation

### 1 — Clone / Extract the project

```bash
unzip uniresolve.zip
cd uniresolve
```

### 2 — Install backend dependencies

```bash
cd backend
npm install
```

### 3 — Configure environment variables

```bash
# Inside the backend/ directory:
cp .env.example .env
```

Open `backend/.env` and set your values:

```env
# Local MongoDB (default):
MONGO_URI=mongodb://localhost:27017/uniresolve

# MongoDB Atlas example:
# MONGO_URI=mongodb+srv://myuser:mypassword@cluster0.abcde.mongodb.net/uniresolve

JWT_SECRET=replace_with_a_long_random_string_at_least_32_chars
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
```

> **Tip — generate a secure JWT secret:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

### 4 — Start MongoDB (local installation only)

```bash
# macOS / Linux
mongod --dbpath /data/db

# Windows (run as Administrator)
mongod --dbpath "C:\data\db"

# Or if installed as a service, it may already be running
```

If you are using **MongoDB Atlas**, skip this step — your connection string already points to the cloud.

### 5 — Seed sample data (recommended for first run)

```bash
# Inside backend/
npm run seed
```

This creates the following demo accounts:

| Role    | Email                       | Password  |
|---------|-----------------------------|-----------|
| Admin   | admin@university.edu        | admin123  |
| Student | sarah.j@university.edu      | demo123   |

It also inserts 5 sample complaints so the admin dashboard is populated.

### 6 — Start the server

```bash
# Production mode
npm start

# Development mode (auto-restarts on file changes — requires nodemon)
npm run dev
```

Open your browser at: **http://localhost:5000**

---

## API Reference

All endpoints are prefixed with `/api`.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register a new student account |
| POST | `/api/auth/login` | Public | Log in, receive a JWT |
| GET  | `/api/auth/me` | 🔒 Bearer | Get current user profile |

**Register body:**
```json
{
  "name": "John Doe",
  "email": "john@university.edu",
  "password": "securepass",
  "studentId": "STU-2024-0999"
}
```

**Login body:**
```json
{
  "email": "john@university.edu",
  "password": "securepass"
}
```

**Login / Register response:**
```json
{
  "success": true,
  "token": "<jwt>",
  "user": { "id": "...", "name": "...", "email": "...", "studentId": "...", "role": "student" }
}
```

---

### Complaints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/api/complaints` | 🔒 Bearer | Student: own complaints. Admin: all complaints |
| GET    | `/api/complaints/stats` | 🔒 Bearer | Count per status (scoped per role) |
| GET    | `/api/complaints/:id` | 🔒 Bearer | Single complaint by `complaintId` (e.g. `CMP-1001`) |
| POST   | `/api/complaints` | 🔒 Bearer | Submit a new complaint |
| PUT    | `/api/complaints/:id/status` | 🔒 Admin | Update status and/or admin notes |
| DELETE | `/api/complaints/:id` | 🔒 Admin | Delete a complaint |

**Query parameters (GET /api/complaints):**

| Param | Values | Example |
|-------|--------|---------|
| `status` | `Pending` · `In Progress` · `Resolved` | `?status=Pending` |
| `category` | `Academics` · `Facilities` · `Administration` | `?category=Facilities` |
| `search` | Any string — matches title, studentName, studentId | `?search=library` |

**Submit complaint body:**
```json
{
  "title": "Broken projector in Room 101",
  "category": "Facilities",
  "description": "The projector in Room 101 has not been working for three days..."
}
```

**Update status body (admin only):**
```json
{
  "status": "In Progress",
  "adminNotes": "We have contacted facilities management."
}
```

---

## How JWT Authentication Works

1. User logs in → server returns a signed JWT.
2. Frontend stores the JWT in `localStorage` (`uniresolve_token`).
3. Every subsequent API call includes the header:
   ```
   Authorization: Bearer <token>
   ```
4. The `protect` middleware verifies the token on every protected route.
5. The `adminOnly` middleware additionally checks `user.role === 'admin'`.
6. Tokens expire after 7 days (configurable via `JWT_EXPIRES_IN`).

---

## Development Tips

### Running frontend separately (Live Server / VS Code)

If you are editing HTML/CSS and want hot-reload, open the `public/` folder with VS Code Live Server (typically on port 5500). The frontend's `API_BASE` in `main.js` will automatically point to `http://localhost:5000` for API calls.

Make sure the backend is running on port 5000 first.

### Changing the MongoDB database name

Edit the path in `MONGO_URI`:
```
mongodb://localhost:27017/my_custom_db_name
```

### Resetting the database

```bash
cd backend
npm run seed
```

The seed script deletes all users and complaints before re-inserting.

---

## Security Notes

- Passwords are hashed with **bcryptjs** (salt rounds: 10) — never stored in plain text.
- JWTs are signed with `HS256` using `JWT_SECRET` from `.env`.
- Rate limiting is applied to all `/api` routes (100 req / 15 min) and stricter limits on `/api/auth` (20 req / 15 min).
- Input validation is performed server-side with **express-validator** on all write endpoints.
- Students can only read/create their own complaints; status updates and deletes are admin-only.

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| `MongoDB connection error` | Ensure `mongod` is running (local) or your Atlas URI is correct |
| `Port 5000 in use` | Change `PORT` in `.env` or kill the other process |
| `Not authorised — no token provided` | You need to log in first; the JWT is missing or expired |
| Pages load but API calls fail (CORS) | Make sure the backend is running on port 5000 and CORS allows your frontend origin |
| `npm run dev` not found | Install nodemon: `npm install -g nodemon` or `npm install` inside `backend/` |

---

## License

MIT — free to use and modify for educational purposes.
