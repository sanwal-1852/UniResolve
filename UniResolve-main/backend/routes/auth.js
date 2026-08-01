const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const jwtSecret = () => process.env.JWT_SECRET || 'usp-local-secret';

const signToken = (userId) =>
  jwt.sign({ id: userId }, jwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      studentId: user.studentId,
      role: user.role,
      department: user.department,
    },
  });
};

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('studentId').trim().isLength({ min: 3 }).withMessage('Student ID must be at least 3 characters'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
      const { name, email, password, studentId, department } = req.body;

      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }

      const existingId = await User.findOne({ studentId });
      if (existingId) {
        return res.status(409).json({ success: false, message: 'An account with this student ID already exists' });
      }

      const user = await User.create({
        name,
        email,
        password,
        studentId,
        department: department || 'General',
        role: 'student',
      });

      sendTokenResponse(user, 201, res);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Enter a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');

      if (!user || !(await user.matchPassword(password))) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      sendTokenResponse(user, 200, res);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      studentId: req.user.studentId,
      role: req.user.role,
      department: req.user.department,
    },
  });
});

module.exports = router;
