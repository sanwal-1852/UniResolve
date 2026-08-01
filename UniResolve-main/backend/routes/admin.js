const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Category = require('../models/Category');
const Department = require('../models/Department');
const { protect, allowRoles } = require('../middleware/auth');

const router = express.Router();
router.use(protect, allowRoles('admin'));

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg });
    return false;
  }
  return true;
}

router.get('/coordinators', async (req, res, next) => {
  try {
    const coordinators = await User.find({ role: 'coordinator' }).select('-password').sort({ name: 1 });
    res.json({ success: true, coordinators });
  } catch (err) {
    next(err);
  }
});

router.get('/students', async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student' }).select('name email studentId department').sort({ name: 1 });
    res.json({ success: true, students });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/coordinators',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Coordinator name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('department').trim().isLength({ min: 2 }).withMessage('Department is required'),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      const exists = await User.findOne({ email: req.body.email });
      if (exists) return res.status(409).json({ success: false, message: 'A user with this email already exists' });

      const coordinator = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        studentId: req.body.studentId || `COORD-${Date.now()}`,
        role: 'coordinator',
        department: req.body.department,
      });

      res.status(201).json({ success: true, coordinator });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/categories',
  [body('name').trim().isLength({ min: 2 }).withMessage('Category name is required')],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      const category = await Category.create({ name: req.body.name, description: req.body.description || '' });
      res.status(201).json({ success: true, category });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'Category already exists' });
      next(err);
    }
  }
);

router.get('/departments', async (req, res, next) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json({ success: true, departments });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/departments',
  [body('name').trim().isLength({ min: 2 }).withMessage('Department name is required')],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      const department = await Department.create({ name: req.body.name, description: req.body.description || '' });
      res.status(201).json({ success: true, department });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'Department already exists' });
      next(err);
    }
  }
);

module.exports = router;
