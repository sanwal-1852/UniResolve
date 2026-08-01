const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Category = require('../models/Category');
const Department = require('../models/Department');
const Notification = require('../models/Notification');
const { protect, allowRoles } = require('../middleware/auth');

const router = express.Router();
const statuses = ['Submitted', 'Under Review', 'Rejected', 'Assigned', 'In Progress', 'Resolved', 'Reopen Requested'];
const defaultCategories = ['Academics', 'Facilities', 'Administration', 'IT Services', 'Examination', 'Transport', 'Hostel', 'Fee/Accounts'];
const defaultDepartments = ['IT Department', 'Examination Department', 'Accounts Department', 'Transport Office', 'Hostel Office', 'Academic Office', 'Maintenance Department', 'Administration Office'];
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    cb(null, allowed.includes(file.mimetype));
  },
});

function baseQueryFor(user) {
  if (user.role === 'student') return { student: user._id };
  if (user.role === 'coordinator') return { assignedCoordinator: user._id };
  return {};
}

function addTimeline(complaint, status, message, user) {
  complaint.timeline.push({
    status,
    message,
    actorRole: user.role,
    actorName: user.name,
  });
}

function presentComplaint(complaint, user) {
  const data = typeof complaint.toObject === 'function' ? complaint.toObject() : { ...complaint };
  const isOwner = user.role === 'student' && data.student?.toString() === user._id.toString();

  if (data.isAnonymous && !isOwner) {
    data.studentName = 'Anonymous Student';
    data.studentEmail = 'Hidden';
    data.studentId = 'Hidden';
  }

  return data;
}

function presentComplaints(complaints, user) {
  return complaints.map((complaint) => presentComplaint(complaint, user));
}

async function notifyStudent(complaint, title, message, type = 'info') {
  await Notification.create({
    user: complaint.student,
    complaint: complaint._id,
    complaintId: complaint.complaintId,
    title,
    message,
    type,
  });
}

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg });
    return false;
  }
  return true;
}

router.get('/meta', protect, async (req, res, next) => {
  try {
    const [categoryCount, departmentCount] = await Promise.all([
      Category.countDocuments(),
      Department.countDocuments(),
    ]);

    if (categoryCount === 0) {
      await Category.insertMany(defaultCategories.map((name) => ({ name })));
    }

    if (departmentCount === 0) {
      await Department.insertMany(defaultDepartments.map((name) => ({ name })));
    }

    const [categories, departments, coordinators] = await Promise.all([
      Category.find().sort({ name: 1 }),
      Department.find().sort({ name: 1 }),
      User.find({ role: 'coordinator' }).select('name email department studentId').sort({ name: 1 }),
    ]);

    res.json({ success: true, statuses, categories, departments, coordinators });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', protect, allowRoles('student'), async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, notifications });
  } catch (err) {
    next(err);
  }
});

router.put('/notifications/:id/read', protect, allowRoles('student'), async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/', protect, async (req, res, next) => {
  try {
    const { status, category, department, search } = req.query;
    const query = baseQueryFor(req.user);

    // `status` accepts a single value or a comma-separated group, so a
    // dashboard card such as "Pending" can filter by several statuses
    // at once and always show exactly what it counted.
    if (status && status !== 'All') {
      const wanted = String(status).split(',').map((s) => s.trim()).filter((s) => statuses.includes(s));
      if (wanted.length === 1) query.status = wanted[0];
      else if (wanted.length > 1) query.status = { $in: wanted };
    }
    if (category && category !== 'All') query.category = category;
    if (department && department !== 'All') query.department = department;

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { title: regex },
        { studentName: regex },
        { studentId: regex },
        { complaintId: regex },
        { category: regex },
        { department: regex },
      ];
    }

    const complaints = await Complaint.find(query).sort({ createdAt: -1 });
    res.json({ success: true, count: complaints.length, complaints: presentComplaints(complaints, req.user) });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', protect, async (req, res, next) => {
  try {
    const stats = await Complaint.aggregate([
      { $match: baseQueryFor(req.user) },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const result = { total: 0 };
    statuses.forEach((status) => { result[status] = 0; });
    stats.forEach(({ _id, count }) => {
      result[_id] = count;
      result.total += count;
    });

    res.json({ success: true, stats: result });
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/summary', protect, allowRoles('admin'), async (req, res, next) => {
  try {
    const complaints = await Complaint.find();
    const rated = complaints.filter((complaint) => complaint.feedback?.rating);
    const avgRating = rated.length
      ? rated.reduce((sum, complaint) => sum + complaint.feedback.rating, 0) / rated.length
      : 0;
    const avgResolutionMs = complaints
      .filter((complaint) => complaint.resolvedAt)
      .reduce((sum, complaint, _, list) => sum + ((complaint.resolvedAt - complaint.createdAt) / list.length), 0);

    const departmentRatings = {};
    const coordinatorRatings = {};
    const priorityCounts = { Low: 0, Medium: 0, High: 0, Urgent: 0 };
    complaints.forEach((complaint) => {
      priorityCounts[complaint.priority || 'Medium'] = (priorityCounts[complaint.priority || 'Medium'] || 0) + 1;
      if (complaint.feedback?.rating) {
        const dept = complaint.department || 'Unassigned';
        const coord = complaint.assignedCoordinatorName || 'Not assigned';
        departmentRatings[dept] = departmentRatings[dept] || { total: 0, count: 0 };
        coordinatorRatings[coord] = coordinatorRatings[coord] || { total: 0, count: 0 };
        departmentRatings[dept].total += complaint.feedback.rating;
        departmentRatings[dept].count += 1;
        coordinatorRatings[coord].total += complaint.feedback.rating;
        coordinatorRatings[coord].count += 1;
      }
    });

    const toAverageRows = (source) => Object.entries(source)
      .map(([name, value]) => ({ name, average: Number((value.total / value.count).toFixed(1)), count: value.count }))
      .sort((a, b) => b.average - a.average);

    res.json({
      success: true,
      summary: {
        totalComplaints: complaints.length,
        feedbackCount: rated.length,
        averageRating: Number(avgRating.toFixed(1)),
        averageResolutionHours: Number((avgResolutionMs / 36e5).toFixed(1)),
        reopenPending: complaints.filter((complaint) => complaint.reopenRequest?.status === 'Pending').length,
        lowRated: rated.filter((complaint) => complaint.feedback.rating <= 2).length,
        priorityCounts,
        departmentRatings: toAverageRows(departmentRatings),
        coordinatorRatings: toAverageRows(coordinatorRatings),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/reports/csv', protect, allowRoles('admin'), async (req, res, next) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    const rows = [
      ['ID', 'Title', 'Student', 'Category', 'Department', 'Priority', 'Status', 'Coordinator', 'Rating', 'Satisfaction', 'Submitted', 'Resolved'],
      ...complaints.map((complaint) => [
        complaint.complaintId,
        complaint.title,
        complaint.isAnonymous ? 'Anonymous Student' : complaint.studentName,
        complaint.category,
        complaint.department,
        complaint.priority || 'Medium',
        complaint.status,
        complaint.assignedCoordinatorName || '',
        complaint.feedback?.rating || '',
        complaint.feedback?.satisfaction || '',
        complaint.createdAt?.toISOString() || '',
        complaint.resolvedAt?.toISOString() || '',
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="complaints-report.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/reports/coordinator/csv', protect, allowRoles('coordinator'), async (req, res, next) => {
  try {
    const allowedScopes = ['all', 'assigned', 'in-progress', 'resolved'];
    const scope = allowedScopes.includes(req.query.scope) ? req.query.scope : 'all';
    const query = { assignedCoordinator: req.user._id };
    if (scope === 'assigned') query.status = 'Assigned';
    if (scope === 'in-progress') query.status = 'In Progress';
    if (scope === 'resolved') query.status = 'Resolved';

    const complaints = await Complaint.find(query).sort({ createdAt: -1 });
    const rows = [
      ['ID', 'Title', 'Student', 'Category', 'Department', 'Priority', 'Status', 'Rating', 'Satisfaction', 'Submitted', 'Resolved'],
      ...complaints.map((complaint) => [
        complaint.complaintId,
        complaint.title,
        complaint.isAnonymous ? 'Anonymous Student' : complaint.studentName,
        complaint.category,
        complaint.department,
        complaint.priority || 'Medium',
        complaint.status,
        complaint.feedback?.rating || '',
        complaint.feedback?.satisfaction || '',
        complaint.createdAt?.toISOString() || '',
        complaint.resolvedAt?.toISOString() || '',
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="coordinator-${scope}-complaints-report.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const complaint = await Complaint.findOne({ complaintId: req.params.id });

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (req.user.role === 'student' && complaint.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only view your own complaints' });
    }

    if (req.user.role === 'coordinator' && complaint.assignedCoordinator?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'This complaint is not assigned to you' });
    }

    res.json({ success: true, complaint: presentComplaint(complaint, req.user) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  protect,
  allowRoles('student'),
  upload.array('attachments', 5),
  [
    body('title').trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
    body('category').trim().isLength({ min: 2 }).withMessage('Category is required'),
    body('department').trim().isLength({ min: 2 }).withMessage('Department is required'),
    body('description').trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      const attachments = (req.files || []).map((file) => ({
        originalName: file.originalname,
        fileName: file.filename,
        path: `/uploads/${file.filename}`,
        mimetype: file.mimetype,
        size: file.size,
      }));

      const complaint = await Complaint.create({
        title: req.body.title,
        category: req.body.category,
        department: req.body.department,
        description: req.body.description,
        attachments,
        isAnonymous: req.body.isAnonymous === 'true',
        student: req.user._id,
        studentName: req.user.name,
        studentEmail: req.user.email,
        studentId: req.user.studentId,
        timeline: [{
          status: 'Submitted',
          message: 'Complaint submitted by student.',
          actorRole: 'student',
          actorName: req.user.name,
        }],
      });

      res.status(201).json({ success: true, complaint });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/admin-create',
  protect,
  allowRoles('admin'),
  [
    body('studentMode').isIn(['existing', 'manual']).withMessage('Select a valid student option'),
    body('title').trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
    body('category').trim().isLength({ min: 2 }).withMessage('Category is required'),
    body('department').trim().isLength({ min: 2 }).withMessage('Department is required'),
    body('description').trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      let student;
      if (req.body.studentMode === 'existing') {
        if (!req.body.studentId) {
          return res.status(400).json({ success: false, message: 'Please select a student' });
        }
        student = await User.findOne({ _id: req.body.studentId, role: 'student' });
        if (!student) return res.status(404).json({ success: false, message: 'Selected student was not found' });
      } else {
        const { manualStudentName, manualStudentEmail, manualStudentId, manualStudentDepartment } = req.body;
        if (!manualStudentName || !manualStudentEmail || !manualStudentId) {
          return res.status(400).json({ success: false, message: 'Student name, email, and registration number are required' });
        }
        student = await User.findOne({ $or: [{ email: manualStudentEmail }, { studentId: manualStudentId }] });
        if (student && student.role !== 'student') {
          return res.status(409).json({ success: false, message: 'That email or registration number belongs to a staff account' });
        }
        if (!student) {
          student = await User.create({
            name: manualStudentName,
            email: manualStudentEmail,
            password: req.body.manualStudentPassword || 'student123',
            studentId: manualStudentId,
            department: manualStudentDepartment || 'General',
            role: 'student',
          });
        }
      }

      let coordinator = null;
      if (req.body.assignImmediately) {
        if (!req.body.coordinatorId) {
          return res.status(400).json({ success: false, message: 'Please select a coordinator for immediate assignment' });
        }
        coordinator = await User.findOne({ _id: req.body.coordinatorId, role: 'coordinator' });
        if (!coordinator) return res.status(404).json({ success: false, message: 'Coordinator not found' });
      }

      const complaint = await Complaint.create({
        title: req.body.title,
        category: req.body.category,
        department: req.body.department,
        description: req.body.description,
        priority: req.body.priority || 'Medium',
        status: coordinator ? 'Assigned' : 'Submitted',
        assignedCoordinator: coordinator?._id,
        assignedCoordinatorName: coordinator?.name || '',
        adminNotes: req.body.adminNotes || '',
        student: student._id,
        studentName: student.name,
        studentEmail: student.email,
        studentId: student.studentId,
        timeline: [
          {
            status: 'Submitted',
            message: `Complaint created by admin on behalf of ${student.name}.`,
            actorRole: 'admin',
            actorName: req.user.name,
          },
          ...(coordinator ? [{
            status: 'Assigned',
            message: `Complaint assigned to ${coordinator.name}.`,
            actorRole: 'admin',
            actorName: req.user.name,
          }] : []),
        ],
      });

      await notifyStudent(
        complaint,
        coordinator ? 'Complaint Created and Assigned' : 'Complaint Created',
        coordinator
          ? `${complaint.complaintId} was created by admin on your behalf and assigned to ${coordinator.name}.`
          : `${complaint.complaintId} was created by admin on your behalf.`,
        'info'
      );
      res.status(201).json({ success: true, complaint: presentComplaint(complaint, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id/feedback',
  protect,
  allowRoles('student'),
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('satisfaction').isIn(['Satisfied', 'Neutral', 'Unsatisfied']).withMessage('Select a satisfaction level'),
    body('comment').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }).withMessage('Feedback is too long'),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      const complaint = await Complaint.findOne({ complaintId: req.params.id, student: req.user._id });
      if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
      if (!['Resolved', 'Rejected'].includes(complaint.status)) {
        return res.status(409).json({ success: false, message: 'Feedback is available after a complaint is resolved or rejected' });
      }

      complaint.feedback = {
        rating: Number(req.body.rating),
        satisfaction: req.body.satisfaction,
        comment: req.body.comment || '',
        submittedAt: new Date(),
      };
      addTimeline(complaint, 'Feedback Submitted', `Student submitted ${req.body.rating}/5 feedback.`, req.user);
      await complaint.save();

      res.json({ success: true, complaint: presentComplaint(complaint, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id/reopen-request',
  protect,
  allowRoles('student'),
  [body('reason').trim().isLength({ min: 10 }).withMessage('Please explain why this complaint should be reopened')],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      const complaint = await Complaint.findOne({ complaintId: req.params.id, student: req.user._id });
      if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
      if (complaint.status !== 'Resolved') {
        return res.status(409).json({ success: false, message: 'Only resolved complaints can be requested for reopening' });
      }

      complaint.status = 'Reopen Requested';
      complaint.reopenRequest = {
        requested: true,
        reason: req.body.reason,
        status: 'Pending',
        requestedAt: new Date(),
      };
      addTimeline(complaint, 'Reopen Requested', `Student requested reopening: ${req.body.reason}`, req.user);
      await complaint.save();

      res.json({ success: true, complaint: presentComplaint(complaint, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Move a freshly submitted complaint into "Under Review" so the student can
 * see an admin has picked it up before it is assigned or rejected.
 */
router.put(
  '/:id/review',
  protect,
  allowRoles('admin'),
  async (req, res, next) => {
    try {
      const complaint = await Complaint.findOne({ complaintId: req.params.id });
      if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
      if (complaint.status !== 'Submitted') {
        return res.status(409).json({ success: false, message: 'Only newly submitted complaints can be marked under review' });
      }

      complaint.status = 'Under Review';
      complaint.adminNotes = req.body.adminNotes || complaint.adminNotes;
      addTimeline(complaint, 'Under Review', 'Complaint is being verified by admin.', req.user);
      await complaint.save();
      await notifyStudent(complaint, 'Complaint Under Review', `${complaint.complaintId} is now being reviewed by the admin office.`, 'info');

      res.json({ success: true, complaint: presentComplaint(complaint, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id/reject',
  protect,
  allowRoles('admin'),
  [body('rejectionReason').trim().isLength({ min: 5 }).withMessage('Rejection reason is required')],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      const complaint = await Complaint.findOne({ complaintId: req.params.id });
      if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
      if (!['Submitted', 'Under Review'].includes(complaint.status)) {
        return res.status(409).json({ success: false, message: 'This complaint has already been handled by admin' });
      }

      complaint.status = 'Rejected';
      complaint.rejectionReason = req.body.rejectionReason;
      complaint.adminNotes = req.body.adminNotes || complaint.adminNotes;
      addTimeline(complaint, 'Rejected', `Complaint rejected: ${req.body.rejectionReason}`, req.user);
      await complaint.save();
      await notifyStudent(complaint, 'Complaint Rejected', `${complaint.complaintId} was rejected. Reason: ${req.body.rejectionReason}`, 'danger');

      res.json({ success: true, complaint });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id/assign',
  protect,
  allowRoles('admin'),
  [
    body('coordinatorId').isMongoId().withMessage('Select a valid coordinator'),
    body('department').trim().isLength({ min: 2 }).withMessage('Department is required'),
    body('priority').optional().isIn(['Low', 'Medium', 'High', 'Urgent']).withMessage('Select a valid priority'),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      const [complaint, coordinator] = await Promise.all([
        Complaint.findOne({ complaintId: req.params.id }),
        User.findOne({ _id: req.body.coordinatorId, role: 'coordinator' }),
      ]);

      if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
      if (!coordinator) return res.status(404).json({ success: false, message: 'Coordinator not found' });
      if (!['Submitted', 'Under Review'].includes(complaint.status)) {
        return res.status(409).json({ success: false, message: 'This complaint has already been handled by admin' });
      }

      complaint.status = 'Assigned';
      complaint.department = req.body.department;
      complaint.priority = req.body.priority || complaint.priority || 'Medium';
      complaint.assignedCoordinator = coordinator._id;
      complaint.assignedCoordinatorName = coordinator.name;
      complaint.adminNotes = req.body.adminNotes || complaint.adminNotes;
      addTimeline(complaint, 'Assigned', `Complaint assigned to ${coordinator.name}.`, req.user);
      await complaint.save();
      await notifyStudent(complaint, 'Complaint Assigned', `${complaint.complaintId} was accepted and assigned to ${coordinator.name}.`, 'info');

      res.json({ success: true, complaint });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id/reassign',
  protect,
  allowRoles('admin'),
  [
    body('coordinatorId').isMongoId().withMessage('Select a valid coordinator'),
    body('department').trim().isLength({ min: 2 }).withMessage('Department is required'),
    body('priority').optional().isIn(['Low', 'Medium', 'High', 'Urgent']).withMessage('Select a valid priority'),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      const [complaint, coordinator] = await Promise.all([
        Complaint.findOne({ complaintId: req.params.id }),
        User.findOne({ _id: req.body.coordinatorId, role: 'coordinator' }),
      ]);

      if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
      if (!coordinator) return res.status(404).json({ success: false, message: 'Coordinator not found' });
      if (complaint.status !== 'Assigned') {
        return res.status(409).json({ success: false, message: 'Only assigned complaints can be reassigned' });
      }

      complaint.department = req.body.department;
      complaint.priority = req.body.priority || complaint.priority || 'Medium';
      complaint.assignedCoordinator = coordinator._id;
      complaint.assignedCoordinatorName = coordinator.name;
      complaint.adminNotes = req.body.adminNotes || complaint.adminNotes;
      addTimeline(complaint, 'Reassigned', `Complaint reassigned to ${coordinator.name}.`, req.user);
      await complaint.save();
      await notifyStudent(complaint, 'Complaint Reassigned', `${complaint.complaintId} was reassigned to ${coordinator.name}.`, 'info');

      res.json({ success: true, complaint: presentComplaint(complaint, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id/reopen-review',
  protect,
  allowRoles('admin'),
  [
    body('decision').isIn(['Approved', 'Rejected']).withMessage('Select a valid reopen decision'),
    body('adminResponse').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }).withMessage('Response is too long'),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      const complaint = await Complaint.findOne({ complaintId: req.params.id });
      if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
      if (complaint.reopenRequest?.status !== 'Pending') {
        return res.status(409).json({ success: false, message: 'There is no pending reopen request for this complaint' });
      }

      complaint.reopenRequest.status = req.body.decision;
      complaint.reopenRequest.reviewedAt = new Date();
      complaint.reopenRequest.adminResponse = req.body.adminResponse || '';

      if (req.body.decision === 'Approved') {
        complaint.status = 'Assigned';
        addTimeline(complaint, 'Reopen Approved', req.body.adminResponse || 'Complaint reopened by admin.', req.user);
        await notifyStudent(complaint, 'Reopen Approved', `${complaint.complaintId} has been reopened for further review.`, 'info');
      } else {
        complaint.status = 'Resolved';
        addTimeline(complaint, 'Reopen Rejected', req.body.adminResponse || 'Reopen request rejected by admin.', req.user);
        await notifyStudent(complaint, 'Reopen Rejected', `${complaint.complaintId} will remain resolved. ${req.body.adminResponse || ''}`, 'danger');
      }

      await complaint.save();
      res.json({ success: true, complaint: presentComplaint(complaint, req.user) });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id/coordinator-status',
  protect,
  allowRoles('coordinator'),
  [
    body('status').isIn(['In Progress', 'Resolved']).withMessage('Coordinator can mark complaints In Progress or Resolved'),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;

    try {
      const complaint = await Complaint.findOne({ complaintId: req.params.id, assignedCoordinator: req.user._id });
      if (!complaint) return res.status(404).json({ success: false, message: 'Assigned complaint not found' });
      if (complaint.status === 'Resolved') {
        return res.status(409).json({ success: false, message: 'Resolved complaints are view-only' });
      }

      complaint.status = req.body.status;
      complaint.coordinatorNotes = req.body.coordinatorNotes || complaint.coordinatorNotes;
      addTimeline(complaint, req.body.status, req.body.coordinatorNotes || `Complaint marked ${req.body.status}.`, req.user);
      await complaint.save();

      if (req.body.status === 'Resolved') {
        await notifyStudent(complaint, 'Complaint Resolved', `${complaint.complaintId} has been resolved. ${complaint.coordinatorNotes || ''}`, 'success');
      }

      res.json({ success: true, complaint });
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id', protect, allowRoles('admin'), async (req, res, next) => {
  try {
    const complaint = await Complaint.findOneAndDelete({ complaintId: req.params.id });

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    await Notification.deleteMany({ complaintId: req.params.id });

    res.json({ success: true, message: `Complaint ${req.params.id} deleted` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
