const mongoose = require('mongoose');

// Keeps the history of who was assigned which request, by whom and when
const assignmentSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
    officer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true },
    active: { type: Boolean, default: true }, // false once re-assigned
  },
  { timestamps: true }
);

module.exports = mongoose.model('Assignment', assignmentSchema);
