const express = require('express');
const { body, validationResult } = require('express-validator');
const Shift = require('../models/Shift');
const { protect, managerOnly } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/shifts/my  — current user's shifts this week
router.get('/my', async (req, res) => {
  try {
    const now    = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const shifts = await Shift.find({
      user: req.user._id,
      date: { $gte: monday, $lte: sunday }
    }).sort({ date: 1, startTime: 1 });

    res.json({ success: true, shifts, weekStart: monday, weekEnd: sunday });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/shifts
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'employee' && !req.query.userId) {
      filter.user = req.user._id;
    } else if (req.query.userId) {
      filter.user = req.query.userId;
    }
    if (req.query.status)     filter.status     = req.query.status;
    if (req.query.department) filter.department = req.query.department;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to)   filter.date.$lte = new Date(req.query.to);
    }
    const shifts = await Shift.find(filter)
      .populate('user', 'name department')
      .sort({ date: 1, startTime: 1 });
    res.json({ success: true, count: shifts.length, shifts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/shifts/:id
router.get('/:id', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id).populate('user', 'name department');
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });
    res.json({ success: true, shift });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/shifts  (manager only)
router.post('/', managerOnly, [
  body('userId').notEmpty().withMessage('userId required'),
  body('date').isISO8601().withMessage('Valid date required'),
  body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('startTime must be HH:MM'),
  body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('endTime must be HH:MM'),
  body('department').notEmpty(),
  body('type').isIn(['Morning', 'Afternoon', 'Night', 'Half']),
], async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ success: false, errors: errs.array() });
  try {
    const shift = await Shift.create({
      user:       req.body.userId,
      date:       new Date(req.body.date),
      startTime:  req.body.startTime,
      endTime:    req.body.endTime,
      department: req.body.department,
      type:       req.body.type,
      status:     req.body.status || 'Confirmed',
      notes:      req.body.notes
    });
    const populated = await shift.populate('user', 'name department');
    res.status(201).json({ success: true, shift: populated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Shift already exists for this user at this time' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/shifts/bulk  (manager only)
router.post('/bulk', managerOnly, async (req, res) => {
  try {
    const { shifts } = req.body;
    if (!Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide an array of shifts' });
    }
    const docs = shifts.map(s => ({
      user: s.userId, date: new Date(s.date),
      startTime: s.startTime, endTime: s.endTime,
      department: s.department, type: s.type,
      status: s.status || 'Confirmed', notes: s.notes
    }));
    const result = await Shift.insertMany(docs, { ordered: false });
    res.status(201).json({ success: true, created: result.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/shifts/:id
router.patch('/:id', async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

    const isOwner  = shift.user.toString() === req.user._id.toString();
    const isMgr    = req.user.role === 'manager';
    if (!isOwner && !isMgr) {
      return res.status(403).json({ success: false, message: 'Not authorised to edit this shift' });
    }
    const allowed = isMgr
      ? ['status', 'startTime', 'endTime', 'date', 'department', 'type', 'notes']
      : ['notes'];
    allowed.forEach(k => { if (req.body[k] !== undefined) shift[k] = req.body[k]; });
    await shift.save();
    res.json({ success: true, shift });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/shifts/:id  (manager only)
router.delete('/:id', managerOnly, async (req, res) => {
  try {
    const shift = await Shift.findByIdAndDelete(req.params.id);
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });
    res.json({ success: true, message: 'Shift deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
