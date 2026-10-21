const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Role = require('../models/Role');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { audit } = require('../utils/activity');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role.name }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

// Slow down brute-force login attempts (20 tries per 15 minutes per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 20,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

// POST /api/auth/register  — self-registration is always as Student/Staff
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/\d/).withMessage('Password must contain a number'),
    body('department').optional().trim(),
    body('phone').optional().trim(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, password, department, phone } = req.body;
    if (await User.exists({ email })) throw new ApiError(409, 'Email is already registered');

    const role = await Role.findOne({ name: 'user' });
    const user = await User.create({ name, email, password, department, phone, role: role._id });
    await user.populate('role');

    req.user = user;
    await audit(req, 'USER_REGISTERED', 'User', user._id, email);
    res.status(201).json({ success: true, token: signToken(user), user });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select('+password').populate('role');
    if (!user || !(await user.comparePassword(req.body.password))) {
      throw new ApiError(401, 'Invalid email or password');
    }
    if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated');

    req.user = user;
    await audit(req, 'USER_LOGIN', 'User', user._id);
    res.json({ success: true, token: signToken(user), user });
  })
);

// GET /api/auth/me — returns the logged-in user (used to restore a session)
router.get('/me', protect, (req, res) => res.json({ success: true, user: req.user }));

// POST /api/auth/logout — JWT is stateless; the client discards the token
router.post(
  '/logout',
  protect,
  asyncHandler(async (req, res) => {
    await audit(req, 'USER_LOGOUT', 'User', req.user._id);
    res.json({ success: true, message: 'Logged out' });
  })
);

module.exports = router;
