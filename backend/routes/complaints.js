const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const { protect, adminOnly } = require('../middleware/auth');

// ─── GET /api/complaints ──────────────────────────────────────────────────────
// Admin: all complaints (with search/filter)
// Student: only their own complaints
router.get('/', protect, async (req, res, next) => {
  try {
    const { status, category, search } = req.query;
    const query = {};

    // Students see only their own complaints
    if (req.user.role !== 'admin') {
      query.student = req.user._id;
    }

    if (status && status !== 'All') query.status = status;
    if (category && category !== 'All') query.category = category;

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { title: regex },
        { studentName: regex },
        { studentId: regex },
        { complaintId: regex },
      ];
    }

    const complaints = await Complaint.find(query).sort({ createdAt: -1 });

    res.json({ success: true, count: complaints.length, complaints });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/complaints/stats ────────────────────────────────────────────────
// Returns complaint counts per status (scoped per role)
router.get('/stats', protect, async (req, res, next) => {
  try {
    const matchStage = req.user.role !== 'admin' ? { student: req.user._id } : {};

    const stats = await Complaint.aggregate([
      { $match: matchStage },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const result = { total: 0, Pending: 0, 'In Progress': 0, Resolved: 0 };
    stats.forEach(({ _id, count }) => {
      result[_id] = count;
      result.total += count;
    });

    res.json({ success: true, stats: result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/complaints/:id ──────────────────────────────────────────────────
router.get('/:id', protect, async (req, res, next) => {
  try {
    const complaint = await Complaint.findOne({ complaintId: req.params.id });

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Students can only view their own complaint
    if (req.user.role !== 'admin' && complaint.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised to view this complaint' });
    }

    res.json({ success: true, complaint });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/complaints ─────────────────────────────────────────────────────
router.post(
  '/',
  protect,
  [
    body('title').trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
    body('category')
      .isIn(['Academics', 'Facilities', 'Administration'])
      .withMessage('Invalid category'),
    body('description')
      .trim()
      .isLength({ min: 20 })
      .withMessage('Description must be at least 20 characters'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
      const { title, category, description } = req.body;

      const complaint = await Complaint.create({
        title,
        category,
        description,
        student: req.user._id,
        studentName: req.user.name,
        studentEmail: req.user.email,
        studentId: req.user.studentId,
      });

      res.status(201).json({ success: true, complaint });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /api/complaints/:id/status ──────────────────────────────────────────
// Admin only — update status and optionally add notes
router.put(
  '/:id/status',
  protect,
  adminOnly,
  [
    body('status')
      .isIn(['Pending', 'In Progress', 'Resolved'])
      .withMessage('Status must be Pending, In Progress, or Resolved'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
      const complaint = await Complaint.findOne({ complaintId: req.params.id });

      if (!complaint) {
        return res.status(404).json({ success: false, message: 'Complaint not found' });
      }

      complaint.status = req.body.status;
      if (req.body.adminNotes !== undefined) {
        complaint.adminNotes = req.body.adminNotes;
      }

      await complaint.save();

      res.json({ success: true, complaint });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /api/complaints/:id ───────────────────────────────────────────────
// Admin only
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const complaint = await Complaint.findOneAndDelete({ complaintId: req.params.id });

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    res.json({ success: true, message: `Complaint ${req.params.id} deleted` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
