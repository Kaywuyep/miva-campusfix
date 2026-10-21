const router = require('express').Router();
const { body, query } = require('express-validator');
const ServiceRequest = require('../models/ServiceRequest');
const { STATUSES, PRIORITIES } = require('../models/ServiceRequest');
const StatusLog = require('../models/StatusLog');
const Assignment = require('../models/Assignment');
const Category = require('../models/Category');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { audit, notify, broadcastRequest } = require('../utils/activity');

router.use(protect);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Which requests may this user see? (role-based data scoping)
function scopeFor(user) {
  if (user.role.name === 'admin') return {};
  if (user.role.name === 'officer') return { assignedTo: user._id };
  return { requester: user._id };
}

// Build a MongoDB filter from ?q=&status=&category=&priority=&assignedTo=&from=&to=
function buildFilter(user, qs) {
  const filter = scopeFor(user);
  if (qs.status) filter.status = qs.status;
  if (qs.category) filter.category = qs.category;
  if (qs.priority) filter.priority = qs.priority;
  // Only admins may filter by officer; for officers it would widen their scope
  if (qs.assignedTo && user.role.name === 'admin') filter.assignedTo = qs.assignedTo;
  // Date range on submission date; "to" is inclusive of the whole day
  if (qs.from || qs.to) {
    filter.createdAt = {};
    if (qs.from) filter.createdAt.$gte = new Date(qs.from);
    if (qs.to) filter.createdAt.$lt = new Date(new Date(qs.to).getTime() + 864e5);
  }
  if (qs.q) {
    const rx = new RegExp(escapeRegex(qs.q), 'i');
    filter.$or = [{ title: rx }, { ticketNo: rx }, { location: rx }, { description: rx }];
  }
  return filter;
}

async function loadRequestForUser(id, user) {
  const request = await ServiceRequest.findById(id)
    .populate('category', 'name')
    .populate('requester', 'name email department phone')
    .populate('assignedTo', 'name email phone');
  if (!request) throw new ApiError(404, 'Service request not found');

  const role = user.role.name;
  const isOwner = String(request.requester._id) === String(user._id);
  const isAssignee = request.assignedTo && String(request.assignedTo._id) === String(user._id);
  if (role !== 'admin' && !isOwner && !isAssignee) {
    throw new ApiError(403, 'You do not have access to this request');
  }
  return request;
}

const listValidators = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(STATUSES).withMessage('Invalid status'),
  query('priority').optional().isIn(PRIORITIES).withMessage('Invalid priority'),
  query('category').optional().isMongoId().withMessage('Invalid category'),
  query('assignedTo').optional().isMongoId().withMessage('Invalid officer'),
  query('from').optional().isISO8601().withMessage('Invalid start date'),
  query('to').optional().isISO8601().withMessage('Invalid end date'),
];

// GET /api/requests — search, filter, paginate (scoped by role)
router.get(
  '/',
  listValidators,
  validate,
  asyncHandler(async (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const filter = buildFilter(req.user, req.query);

    const [items, total] = await Promise.all([
      ServiceRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('category', 'name')
        .populate('requester', 'name email')
        .populate('assignedTo', 'name email'),
      ServiceRequest.countDocuments(filter),
    ]);

    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
  })
);

// GET /api/requests/stats — counts per status for the dashboard cards
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const scope = scopeFor(req.user);
    const counts = await Promise.all(STATUSES.map((s) => ServiceRequest.countDocuments({ ...scope, status: s })));
    const byStatus = Object.fromEntries(STATUSES.map((s, i) => [s, counts[i]]));
    const total = counts.reduce((a, b) => a + b, 0);
    res.json({ success: true, data: { total, byStatus } });
  })
);

// POST /api/requests — submit a new service request (with optional evidence files)
router.post(
  '/',
  authorize('user', 'admin'),
  upload.array('attachments', 3),
  [
    body('title').trim().isLength({ min: 5, max: 120 }).withMessage('Title must be 5–120 characters'),
    body('description').trim().isLength({ min: 10 }).withMessage('Describe the problem (at least 10 characters)'),
    body('category').isMongoId().withMessage('Choose a category'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('priority').optional().isIn(PRIORITIES).withMessage('Invalid priority'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (!(await Category.exists({ _id: req.body.category, isActive: true }))) {
      throw new ApiError(422, 'Selected category does not exist');
    }
    const attachments = (req.files || []).map((f) => ({
      filename: f.originalname,
      url: `/uploads/${f.filename}`,
      mimetype: f.mimetype,
    }));

    const request = await ServiceRequest.create({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      location: req.body.location,
      priority: req.body.priority || 'medium',
      requester: req.user._id,
      attachments,
    });

    await StatusLog.create({ request: request._id, toStatus: 'pending', comment: 'Request submitted', changedBy: req.user._id });
    await audit(req, 'REQUEST_CREATED', 'ServiceRequest', request._id, request.ticketNo);

    // Tell every admin there is a new request to triage
    const admins = await User.find({ isActive: true }).populate('role');
    await Promise.all(
      admins.filter((u) => u.role.name === 'admin')
        .map((a) => notify(a._id, `New request ${request.ticketNo}: ${request.title}`, request._id))
    );

    res.status(201).json({ success: true, message: 'Request submitted successfully', data: request });
  })
);

// GET /api/requests/:id — full detail with timeline and assignment history
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const request = await loadRequestForUser(req.params.id, req.user);
    const [timeline, assignments] = await Promise.all([
      StatusLog.find({ request: request._id }).sort({ createdAt: 1 }).populate('changedBy', 'name'),
      Assignment.find({ request: request._id }).sort({ createdAt: -1 })
        .populate('officer', 'name').populate('assignedBy', 'name'),
    ]);
    res.json({ success: true, data: { ...request.toObject(), timeline, assignments } });
  })
);

// PUT /api/requests/:id — edit details (owner while still pending, or admin)
router.put(
  '/:id',
  [
    body('title').optional().trim().isLength({ min: 5, max: 120 }).withMessage('Title must be 5–120 characters'),
    body('description').optional().trim().isLength({ min: 10 }).withMessage('Description too short'),
    body('category').optional().isMongoId().withMessage('Invalid category'),
    body('location').optional().trim().notEmpty().withMessage('Location cannot be empty'),
    body('priority').optional().isIn(PRIORITIES).withMessage('Invalid priority'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const request = await loadRequestForUser(req.params.id, req.user);
    const isAdmin = req.user.role.name === 'admin';
    const isOwner = String(request.requester._id) === String(req.user._id);
    if (!isAdmin && !(isOwner && request.status === 'pending')) {
      throw new ApiError(403, 'Only pending requests can be edited by their owner');
    }

    ['title', 'description', 'category', 'location', 'priority'].forEach((f) => {
      if (req.body[f] !== undefined) request[f] = req.body[f];
    });
    await request.save();
    await audit(req, 'REQUEST_UPDATED', 'ServiceRequest', request._id, request.ticketNo);
    res.json({ success: true, message: 'Request updated', data: request });
  })
);

// PATCH /api/requests/:id/status — progress updates
//   officer: in_progress | completed (only on their own assignments)
//   owner:   cancelled (only while pending)
//   admin:   any status
router.patch(
  '/:id/status',
  [
    body('status').isIn(STATUSES).withMessage('Invalid status'),
    body('comment').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const request = await loadRequestForUser(req.params.id, req.user);
    const role = req.user.role.name;
    const next = req.body.status;
    const prev = request.status;

    if (prev === next) throw new ApiError(400, `Request is already ${next}`);
    if (['completed', 'cancelled'].includes(prev) && role !== 'admin') {
      throw new ApiError(400, 'This request is closed');
    }
    if (role === 'officer' && !['in_progress', 'completed'].includes(next)) {
      throw new ApiError(403, 'Officers can only mark requests as in progress or completed');
    }
    if (role === 'user' && !(next === 'cancelled' && prev === 'pending')) {
      throw new ApiError(403, 'You can only cancel a request that is still pending');
    }

    request.status = next;
    request.completedAt = next === 'completed' ? new Date() : undefined;
    // Re-opened by an admin: the old rating no longer describes the outcome (it stays in the audit log)
    if (prev === 'completed') request.feedback = undefined;
    await request.save();

    await StatusLog.create({ request: request._id, fromStatus: prev, toStatus: next, comment: req.body.comment, changedBy: req.user._id });
    await audit(req, 'STATUS_CHANGED', 'ServiceRequest', request._id, `${request.ticketNo}: ${prev} → ${next}`);

    const label = next.replace('_', ' ');
    if (String(request.requester._id) !== String(req.user._id)) {
      const ask = next === 'completed' ? ' — please rate the repair' : '';
      await notify(request.requester._id, `Your request ${request.ticketNo} is now ${label}${ask}`, request._id);
    }
    broadcastRequest(request);

    res.json({ success: true, message: `Status changed to ${label}`, data: request });
  })
);

// POST /api/requests/:id/feedback — the requester rates a completed job (once)
router.post(
  '/:id/feedback',
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Choose a rating from 1 to 5').toInt(),
    body('resolved').isBoolean().withMessage('Tell us whether the problem was fixed').toBoolean(),
    body('comment').optional().trim().isLength({ max: 500 }).withMessage('Comment must be 500 characters or fewer'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const request = await loadRequestForUser(req.params.id, req.user);
    if (String(request.requester._id) !== String(req.user._id)) {
      throw new ApiError(403, 'Only the person who submitted the request can rate it');
    }
    if (request.status !== 'completed') throw new ApiError(400, 'You can rate a request once it is completed');
    if (request.feedback) throw new ApiError(409, 'You have already rated this request');

    const { rating, resolved, comment } = req.body;
    request.feedback = { rating, resolved, comment };
    await request.save();
    await audit(req, 'FEEDBACK_SUBMITTED', 'ServiceRequest', request._id, `${request.ticketNo}: ${rating}/5, ${resolved ? 'fixed' : 'not fixed'}`);

    // Admins (and the officer who did the job) hear about it; "not fixed" is flagged
    const message = resolved
      ? `${request.requester.name} rated ${request.ticketNo} ${rating}/5`
      : `${request.requester.name} says ${request.ticketNo} is NOT fixed (${rating}/5)`;
    const admins = await User.find({ isActive: true }).populate('role');
    const recipients = admins.filter((u) => u.role.name === 'admin').map((a) => a._id);
    if (request.assignedTo) recipients.push(request.assignedTo._id);
    await Promise.all(recipients.map((id) => notify(id, message, request._id)));
    broadcastRequest(request);

    res.status(201).json({ success: true, message: 'Thank you for your feedback', data: request.feedback });
  })
);

// PATCH /api/requests/:id/assign — admin assigns (or re-assigns) a maintenance officer
router.patch(
  '/:id/assign',
  authorize('admin'),
  [body('officerId').isMongoId().withMessage('Choose an officer'), body('note').optional().trim()],
  validate,
  asyncHandler(async (req, res) => {
    const request = await loadRequestForUser(req.params.id, req.user);
    if (['completed', 'cancelled'].includes(request.status)) throw new ApiError(400, 'Cannot assign a closed request');

    const officer = await User.findById(req.body.officerId).populate('role');
    if (!officer || officer.role.name !== 'officer' || !officer.isActive) {
      throw new ApiError(422, 'Selected user is not an active maintenance officer');
    }

    await Assignment.updateMany({ request: request._id, active: true }, { active: false });
    await Assignment.create({ request: request._id, officer: officer._id, assignedBy: req.user._id, note: req.body.note });

    const prev = request.status;
    request.assignedTo = officer._id;
    if (prev === 'pending') request.status = 'assigned';
    await request.save();

    await StatusLog.create({
      request: request._id, fromStatus: prev, toStatus: request.status,
      comment: `Assigned to ${officer.name}${req.body.note ? ` — ${req.body.note}` : ''}`,
      changedBy: req.user._id,
    });
    await audit(req, 'REQUEST_ASSIGNED', 'ServiceRequest', request._id, `${request.ticketNo} → ${officer.email}`);
    await notify(officer._id, `New job assigned: ${request.ticketNo} — ${request.title}`, request._id);
    await notify(request.requester._id, `Your request ${request.ticketNo} has been assigned to an officer`, request._id);
    broadcastRequest(request);

    await request.populate('assignedTo', 'name email phone');
    res.json({ success: true, message: `Assigned to ${officer.name}`, data: request });
  })
);

// DELETE /api/requests/:id — admin only
router.delete(
  '/:id',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const request = await ServiceRequest.findById(req.params.id);
    if (!request) throw new ApiError(404, 'Service request not found');
    await Promise.all([
      StatusLog.deleteMany({ request: request._id }),
      Assignment.deleteMany({ request: request._id }),
      request.deleteOne(),
    ]);
    await audit(req, 'REQUEST_DELETED', 'ServiceRequest', request._id, request.ticketNo);
    res.json({ success: true, message: 'Request deleted' });
  })
);

module.exports = router;
module.exports.buildFilter = buildFilter;
module.exports.listValidators = listValidators;
