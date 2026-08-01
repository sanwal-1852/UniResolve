const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      unique: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    department: {
      type: String,
      default: 'Unassigned',
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    status: {
      type: String,
      enum: ['Submitted', 'Under Review', 'Rejected', 'Assigned', 'In Progress', 'Resolved', 'Reopen Requested'],
      default: 'Submitted',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    // Denormalised student info for fast reads in admin table
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true },
    studentId: { type: String, required: true },
    isAnonymous: {
      type: Boolean,
      default: false,
    },

    // Admin fields
    assignedCoordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedCoordinatorName: {
      type: String,
      default: '',
    },
    rejectionReason: {
      type: String,
      default: '',
      maxlength: [2000, 'Rejection reason cannot exceed 2000 characters'],
    },
    adminNotes: {
      type: String,
      default: '',
      maxlength: [2000, 'Admin notes cannot exceed 2000 characters'],
    },
    coordinatorNotes: {
      type: String,
      default: '',
      maxlength: [2000, 'Coordinator notes cannot exceed 2000 characters'],
    },
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      satisfaction: {
        type: String,
        enum: ['Satisfied', 'Neutral', 'Unsatisfied', ''],
        default: '',
      },
      comment: {
        type: String,
        default: '',
        maxlength: [2000, 'Feedback comment cannot exceed 2000 characters'],
      },
      submittedAt: Date,
    },
    reopenRequest: {
      requested: {
        type: Boolean,
        default: false,
      },
      reason: {
        type: String,
        default: '',
        maxlength: [2000, 'Reopen reason cannot exceed 2000 characters'],
      },
      status: {
        type: String,
        enum: ['None', 'Pending', 'Approved', 'Rejected'],
        default: 'None',
      },
      requestedAt: Date,
      reviewedAt: Date,
      adminResponse: {
        type: String,
        default: '',
        maxlength: [2000, 'Reopen response cannot exceed 2000 characters'],
      },
    },
    attachments: [
      {
        originalName: String,
        fileName: String,
        path: String,
        mimetype: String,
        size: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    timeline: [
      {
        status: String,
        message: String,
        actorRole: String,
        actorName: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

// Auto-generate complaintId before first save
complaintSchema.pre('save', async function (next) {
  if (!this.complaintId) {
    const count = await mongoose.model('Complaint').countDocuments();
    this.complaintId = 'CMP-' + String(1001 + count).padStart(4, '0');
  }
  next();
});

// Set resolvedAt timestamp when status changes to Resolved
complaintSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'Resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Complaint', complaintSchema);
