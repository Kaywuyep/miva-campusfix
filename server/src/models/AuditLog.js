const mongoose = require('mongoose');

// System-wide activity trail (logins, creates, updates, deletes, assignments)
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g. REQUEST_CREATED
    entity: { type: String },                  // e.g. ServiceRequest
    entityId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: String },
    ip: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
