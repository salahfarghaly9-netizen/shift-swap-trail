const mongoose = require('mongoose');

const notifSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:        { type: String, required: true },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  relatedSwap: { type: mongoose.Schema.Types.ObjectId, ref: 'SwapRequest', default: null },
  isRead:      { type: Boolean, default: false }
}, { timestamps: true });

notifSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notifSchema);
