const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { getIO } = require('./socket');

// Write an entry to the audit trail. Never let logging break the main request.
async function audit(req, action, entity, entityId, details) {
  try {
    await AuditLog.create({
      actor: req.user ? req.user._id : undefined,
      action,
      entity,
      entityId,
      details,
      ip: req.ip,
    });
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

// Save an in-app notification and push it live to the user over Socket.IO
async function notify(userId, message, requestId) {
  if (!userId) return;
  const note = await Notification.create({ user: userId, message, request: requestId });
  const io = getIO();
  if (io) io.to(`user:${userId}`).emit('notification', note);
  return note;
}

// Broadcast a status change to everyone watching that request
function broadcastRequest(request) {
  const io = getIO();
  if (io) io.emit('request:updated', { id: String(request._id), status: request.status });
}

module.exports = { audit, notify, broadcastRequest };
