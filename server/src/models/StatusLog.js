const mongoose = require('mongoose');

// One entry every time a request changes status (powers the tracking timeline)
const statusLogSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
    fromStatus: { type: String },
    toStatus: { type: String, required: true },
    comment: { type: String, trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StatusLog', statusLogSchema);
