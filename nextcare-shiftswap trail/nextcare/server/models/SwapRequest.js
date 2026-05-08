const mongoose = require('mongoose');

const swapSchema = new mongoose.Schema({
  requester:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  requesterShift: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', required: true },
  acceptor:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',  default: null },
  reason:         { type: String, maxlength: 500 },
  availableTimes: { type: String, maxlength: 300 },
  urgency:        { type: String, enum: ['Normal', 'Medium', 'Urgent'], default: 'Normal' },
  status: {
    type: String,
    enum: ['Open', 'Accepted', 'Approved', 'Rejected', 'Withdrawn'],
    default: 'Open'
  },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:  { type: Date,   default: null },
  reviewNote:  { type: String, default: '' }
}, { timestamps: true });

swapSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SwapRequest', swapSchema);
