/**
 * ============================================================
 * UniResolve — Express Server Entry Point
 * ============================================================
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');
const errorHandler = require('./middleware/errorHandler');

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB();

const app = express();

// ─── Security & Logging Middleware ────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false                   // same-origin only in production (served statically)
    : ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500'],
  credentials: true,
}));

// Rate limiting — 100 requests per 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests — please try again later' },
});
app.use('/api', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts — try again in 15 minutes' },
});
app.use('/api/auth', authLimiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);

// ─── Serve Frontend (production) ──────────────────────────────────────────────
// In production the public/ folder is served statically.
// In development you can open the HTML files directly or use a live-server.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Catch-all — serve index.html for any unrecognised GET (SPA-style fallback)
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀  UniResolve server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`    http://localhost:${PORT}\n`);
});
