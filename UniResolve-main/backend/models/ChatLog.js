const mongoose = require('mongoose');

/**
 * Records questions UniBot could not confidently answer.
 * Reviewing these shows which phrasings real users try, so the
 * training data can be extended where it actually matters.
 */
const chatLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    role: {
      type: String,
      enum: ['student', 'admin', 'coordinator'],
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    score: {
      type: Number,
      default: 0,
    },
    reviewed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatLog', chatLogSchema);
