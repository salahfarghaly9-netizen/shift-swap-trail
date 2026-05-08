const express      = require('express');
const { body, validationResult } = require('express-validator');
const SwapRequest  = require('../models/SwapRequest');
const Shift        = require('../models/Shift');
const User         = require('../models/User');
const Notification = require('../models/Notification');
const { protect, managerOnly } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

async function notify(userId, type, title, message, swapId) {
  try {
    await Notification.create({ user: userId, type, title, message, relatedSwap: swapId });
  } catch (_) { /* non-critical */ }
}

// GET /api/swaps/stats/summary  (manager) — must come before /:id
router.get('/stats/summary', managerOnly, async (req, res) => {
  try {
    const [open, accepted, approved, rejected, total, urgent] = await Promise.all([
      SwapRequest.countDocuments({ status: 'Open' }),
      SwapRequest.countDocuments({ status: 'Accepted' }),
      SwapRequest.countDocuments({ status: 'Approved' }),
      SwapRequest.countDocuments({ status: 'Rejected' }),
      SwapRequest.countDocuments(),
      SwapRequest.countDocuments({ status: 'Open', urgency: 'Urgent' })
    ]);
    res.json({ success: true, stats: { open, accepted, approved, rejected, total, urgent } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/swaps
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)         filter.status    = req.query.status;
    if (req.query.urgency)        filter.urgency   = req.query.urgency;
    if (req.query.mine === 'true') filter.requester = req.user._id;
    if (!req.query.status && req.query.mine !== 'true') filter.status = 'Open';

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50,  parseInt(req.query.limit) || 20);

    const [swaps, total] = await Promise.all([
      SwapRequest.find(filter)
        .populate('requester', 'name department')
        .populate('acceptor',  'name department')
        .populate({ path: 'requesterShift', populate: { path: 'user', select: 'name' } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit),
      SwapRequest.countDocuments(filter)
    ]);
    res.json({ success: true, total, page, pages: Math.ceil(total / limit), swaps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/swaps/:id
router.get('/:id', async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id)
      .populate('requester',  'name email department swapStats')
      .populate('acceptor',   'name email department')
      .populate('reviewedBy', 'name')
      .populate('requesterShift');
    if (!swap) return res.status(404).json({ success: false, message: 'Swap request not found' });
    res.json({ success: true, swap });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/swaps  — employee posts a swap request
router.post('/', [
  body('shiftId').notEmpty().withMessage('shiftId is required'),
  body('urgency').optional().isIn(['Normal', 'Medium', 'Urgent']),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success: false, errors: errs.array() });
  try {
    const shift = await Shift.findById(req.body.shiftId);
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });
    if (shift.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "This shift doesn't belong to you" });
    }
    if (shift.status === 'Swapped') {
      return res.status(400).json({ success: false, message: 'Shift already swapped' });
    }
    const existing = await SwapRequest.findOne({
      requesterShift: shift._id, status: { $in: ['Open', 'Accepted'] }
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An open swap request already exists for this shift' });
    }
    const swap = await SwapRequest.create({
      requester:      req.user._id,
      requesterShift: shift._id,
      reason:         req.body.reason,
      availableTimes: req.body.availableTimes,
      urgency:        req.body.urgency || 'Normal',
    });
    shift.status = 'NeedsCoverage';
    await shift.save();
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'swapStats.sent': 1 } });
    const populated = await swap.populate([
      { path: 'requester', select: 'name department' },
      { path: 'requesterShift' }
    ]);
    res.status(201).json({ success: true, swap: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/swaps/:id/accept
router.post('/:id/accept', async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id).populate('requester', 'name');
    if (!swap) return res.status(404).json({ success: false, message: 'Swap not found' });
    if (swap.status !== 'Open') {
      return res.status(400).json({ success: false, message: 'Swap is not open for acceptance' });
    }
    if (swap.requester._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You can't accept your own swap" });
    }
    swap.acceptor = req.user._id;
    swap.status   = 'Accepted';
    await swap.save();
    await notify(swap.requester._id, 'swap_accepted', 'Swap Request Accepted',
      `${req.user.name} accepted your swap request — awaiting manager approval`, swap._id);
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'swapStats.received': 1 } });
    res.json({ success: true, swap, message: 'Accepted — awaiting manager approval' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/swaps/:id/withdraw
router.post('/:id/withdraw', async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id).populate('requesterShift');
    if (!swap) return res.status(404).json({ success: false, message: 'Swap not found' });
    if (swap.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your swap request' });
    }
    if (!['Open', 'Accepted'].includes(swap.status)) {
      return res.status(400).json({ success: false, message: "Can't withdraw in current status" });
    }
    swap.status = 'Withdrawn';
    await swap.save();
    if (swap.requesterShift) {
      swap.requesterShift.status = 'Confirmed';
      await swap.requesterShift.save();
    }
    if (swap.acceptor) {
      await notify(swap.acceptor, 'swap_withdrawn', 'Swap Withdrawn',
        `${req.user.name} withdrew the swap request`, swap._id);
    }
    res.json({ success: true, message: 'Swap request withdrawn' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/swaps/:id/approve  (manager)
router.post('/:id/approve', managerOnly, async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id)
      .populate('requesterShift')
      .populate('requester', 'name')
      .populate('acceptor',  'name');
    if (!swap) return res.status(404).json({ success: false, message: 'Swap not found' });
    if (swap.status !== 'Accepted') {
      return res.status(400).json({ success: false, message: 'Swap must be accepted by an employee first' });
    }
    swap.status     = 'Approved';
    swap.reviewedBy = req.user._id;
    swap.reviewedAt = new Date();
    swap.reviewNote = req.body.note || '';
    await swap.save();
    if (swap.requesterShift) {
      swap.requesterShift.status = 'Swapped';
      await swap.requesterShift.save();
    }
    await User.findByIdAndUpdate(swap.requester._id, { $inc: { 'swapStats.completed': 1 } });
    await User.findByIdAndUpdate(swap.acceptor._id,  { $inc: { 'swapStats.completed': 1 } });
    const msg = `Manager ${req.user.name} approved the swap ✓`;
    await notify(swap.requester._id, 'swap_approved', 'Swap Approved', msg, swap._id);
    await notify(swap.acceptor._id,  'swap_approved', 'Swap Approved', msg, swap._id);
    res.json({ success: true, swap, message: 'Approved — both parties notified' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/swaps/:id/reject  (manager)
router.post('/:id/reject', managerOnly, async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id)
      .populate('requesterShift')
      .populate('requester', 'name')
      .populate('acceptor',  'name');
    if (!swap) return res.status(404).json({ success: false, message: 'Swap not found' });
    if (!['Accepted', 'Open'].includes(swap.status)) {
      return res.status(400).json({ success: false, message: "Can't reject in current status" });
    }
    swap.status     = 'Rejected';
    swap.reviewedBy = req.user._id;
    swap.reviewedAt = new Date();
    swap.reviewNote = req.body.note || '';
    await swap.save();
    if (swap.requesterShift) {
      swap.requesterShift.status = 'Confirmed';
      await swap.requesterShift.save();
    }
    const reason = req.body.note ? ` Reason: ${req.body.note}` : '';
    await notify(swap.requester._id, 'swap_rejected', 'Swap Rejected',
      `Your swap request was rejected by the manager.${reason}`, swap._id);
    if (swap.acceptor) {
      await notify(swap.acceptor._id, 'swap_rejected', 'Swap Rejected',
        `The swap was rejected by the manager.${reason}`, swap._id);
    }
    res.json({ success: true, message: 'Rejected — parties notified' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
