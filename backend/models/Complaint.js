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
      enum: {
        values: ['Academics', 'Facilities', 'Administration'],
        message: 'Category must be Academics, Facilities, or Administration',
      },
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Resolved'],
      default: 'Pending',
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

    // Admin fields
    adminNotes: {
      type: String,
      default: '',
      maxlength: [2000, 'Admin notes cannot exceed 2000 characters'],
    },
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
