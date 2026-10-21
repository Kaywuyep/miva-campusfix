const router = require('express').Router();
const ServiceRequest = require('../models/ServiceRequest');
const { STATUSES, PRIORITIES } = require('../models/ServiceRequest');
const Category = require('../models/Category');
const User = require('../models/User');
const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { buildFilter, listValidators } = require('./requests');
const validate = require('../middleware/validate');
const { audit } = require('../utils/activity');

router.use(protect, authorize('admin'));

// GET /api/reports/summary?from=&to=&status=&category=&priority=&assignedTo=
// Numbers for the admin reports page, limited to the requests matching the filters
router.get('/summary', listValidators, validate, asyncHandler(async (req, res) => {
  const base = buildFilter(req.user, req.query);
  const count = (extra) => ServiceRequest.countDocuments({ $and: [base, extra] });

  const statusCounts = await Promise.all(STATUSES.map((s) => count({ status: s })));
  const byStatus = Object.fromEntries(STATUSES.map((s, i) => [s, statusCounts[i]]));

  const byPriority = Object.fromEntries(
    await Promise.all(PRIORITIES.map(async (p) => [p, await count({ priority: p })]))
  );

  const categories = await Category.find().sort({ name: 1 });
  const byCategory = await Promise.all(
    categories.map(async (c) => ({ name: c.name, count: await count({ category: c._id }) }))
  );

  const officerRole = await Role.findOne({ name: 'officer' });
  const officers = await User.find({ role: officerRole._id }).sort({ name: 1 });
  const byOfficer = await Promise.all(
    officers.map(async (o) => ({
      name: o.name,
      open: await count({ assignedTo: o._id, status: { $in: ['assigned', 'in_progress'] } }),
      completed: await count({ assignedTo: o._id, status: 'completed' }),
    }))
  );

  // Average time from submission to completion, in hours
  const done = await ServiceRequest.find({ $and: [base, { status: 'completed', completedAt: { $exists: true } }] })
    .select('createdAt completedAt');
  const avgResolutionHours = done.length
    ? +(done.reduce((sum, r) => sum + (r.completedAt - r.createdAt), 0) / done.length / 36e5).toFixed(1)
    : null;

  res.json({
    success: true,
    data: {
      total: statusCounts.reduce((a, b) => a + b, 0),
      byStatus, byPriority, byCategory, byOfficer, avgResolutionHours,
      generatedAt: new Date(),
    },
  });
}));

// GET /api/reports/export?status=&category=&priority=&assignedTo=&from=&to=&q= — download requests as CSV
router.get('/export', listValidators, validate, asyncHandler(async (req, res) => {
  const rows = await ServiceRequest.find(buildFilter(req.user, req.query))
    .sort({ createdAt: -1 })
    .populate('category', 'name')
    .populate('requester', 'name email')
    .populate('assignedTo', 'name');

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  // Branded heading block so a downloaded report says what it is and what it covers
  const { from, to, status, category, priority, assignedTo, q } = req.query;
  const [cat, officer] = await Promise.all([
    category ? Category.findById(category).select('name') : null,
    assignedTo ? User.findById(assignedTo).select('name') : null,
  ]);
  const filters = [
    status && `Status: ${status}`,
    cat && `Category: ${cat.name}`,
    priority && `Priority: ${priority}`,
    officer && `Officer: ${officer.name}`,
    q && `Search: ${q}`,
  ].filter(Boolean);
  const preamble = [
    ['codespireFix - Service Requests Report'],
    ['University Works & Services Department'],
    ['Generated', new Date().toISOString()],
    ['Period', from || to ? `${from || 'beginning'} to ${to || 'today'}` : 'All time'],
    ['Filters', filters.join('; ') || 'None'],
    ['Total requests', rows.length],
    [],
  ].map((r) => r.map(esc).join(','));

  const header = ['Ticket', 'Title', 'Category', 'Location', 'Priority', 'Status', 'Requester', 'Requester Email', 'Assigned To', 'Created', 'Completed'];
  const lines = rows.map((r) => [
    r.ticketNo, r.title, r.category?.name, r.location, r.priority, r.status,
    r.requester?.name, r.requester?.email, r.assignedTo?.name || '',
    r.createdAt.toISOString(), r.completedAt ? r.completedAt.toISOString() : '',
  ].map(esc).join(','));

  await audit(req, 'REPORT_EXPORTED', 'ServiceRequest', undefined, `${rows.length} rows`);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="codespireFix-report-${Date.now()}.csv"`);
  // BOM so Excel opens the file as UTF-8
  res.send('\uFEFF' + [...preamble, header.map(esc).join(','), ...lines].join('\n'));
}));

// GET /api/reports/audit?page= — the activity log
router.get('/audit', asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = 15;
  const filter = req.query.action ? { action: req.query.action } : {};
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('actor', 'name email'),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
}));

module.exports = router;
