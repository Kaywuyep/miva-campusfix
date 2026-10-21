const router = require('express').Router();
const { body, query } = require('express-validator');
const User = require('../models/User');
const Role = require('../models/Role');
const ServiceRequest = require('../models/ServiceRequest');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { audit } = require('../utils/activity');

router.use(protect, authorize('admin'));

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/users?q=&role=&page=&limit=
router.get(
  '/',
  [query('page').optional().isInt({ min: 1 }).toInt(), query('limit').optional().isInt({ min: 1, max: 100 }).toInt()],
  validate,
  asyncHandler(async (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const filter = {};
    if (req.query.role) {
      const role = await Role.findOne({ name: req.query.role });
      filter.role = role ? role._id : null;
    }
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(req.query.q), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { department: rx }];
    }
    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('role'),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
  })
);

// GET /api/users/officers — active officers with their open workload (for the assign dropdown)
router.get(
  '/officers',
  asyncHandler(async (_req, res) => {
    const role = await Role.findOne({ name: 'officer' });
    const officers = await User.find({ role: role._id, isActive: true }).sort({ name: 1 });
    const loads = await Promise.all(
      officers.map((o) => ServiceRequest.countDocuments({ assignedTo: o._id, status: { $in: ['assigned', 'in_progress'] } }))
    );
    res.json({ success: true, data: officers.map((o, i) => ({ ...o.toJSON(), openJobs: loads[i] })) });
  })
);

// GET /api/users/roles
router.get('/roles', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await Role.find().sort({ name: 1 }) });
}));

// POST /api/users — admin creates any type of account (e.g. maintenance officers)
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['user', 'officer', 'admin']).withMessage('Invalid role'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (await User.exists({ email: req.body.email })) throw new ApiError(409, 'Email is already registered');
    const role = await Role.findOne({ name: req.body.role });
    const user = await User.create({ ...req.body, role: role._id });
    await user.populate('role');
    await audit(req, 'USER_CREATED', 'User', user._id, `${user.email} (${role.name})`);
    res.status(201).json({ success: true, message: 'User created', data: user });
  })
);

// PUT /api/users/:id — change details, role or activate/deactivate
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('role').optional().isIn(['user', 'officer', 'admin']).withMessage('Invalid role'),
    body('isActive').optional().isBoolean().toBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    if (String(user._id) === String(req.user._id) && (req.body.isActive === false || (req.body.role && req.body.role !== 'admin'))) {
      throw new ApiError(400, 'You cannot deactivate or demote your own account');
    }
    ['name', 'department', 'phone', 'isActive'].forEach((f) => {
      if (req.body[f] !== undefined) user[f] = req.body[f];
    });
    if (req.body.role) user.role = (await Role.findOne({ name: req.body.role }))._id;
    await user.save();
    await user.populate('role');
    await audit(req, 'USER_UPDATED', 'User', user._id, user.email);
    res.json({ success: true, message: 'User updated', data: user });
  })
);

// DELETE /api/users/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (String(req.params.id) === String(req.user._id)) throw new ApiError(400, 'You cannot delete your own account');
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    if (await ServiceRequest.exists({ $or: [{ requester: user._id }, { assignedTo: user._id }] })) {
      throw new ApiError(409, 'User has service requests on record — deactivate the account instead');
    }
    await user.deleteOne();
    await audit(req, 'USER_DELETED', 'User', user._id, user.email);
    res.json({ success: true, message: 'User deleted' });
  })
);

module.exports = router;
