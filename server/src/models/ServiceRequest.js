const mongoose = require('mongoose');

const STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const serviceRequestSchema = new mongoose.Schema(
  {
    ticketNo: { type: String, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    location: { type: String, required: true, trim: true }, // e.g. "Hostel B, Room 12"
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    status: { type: String, enum: STATUSES, default: 'pending' },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    attachments: [{ filename: String, url: String, mimetype: String }],
    completedAt: Date,
    // The requester's rating once the job is completed (one per request, embedded)
    feedback: {
      type: new mongoose.Schema(
        {
          rating: { type: Number, min: 1, max: 5, required: true },
          resolved: { type: Boolean, required: true }, // "Was the problem fixed?"
          comment: { type: String, trim: true, maxlength: 500 },
          submittedAt: { type: Date, default: Date.now },
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { timestamps: true }
);

// Generate a human-friendly ticket number, e.g. REQ-2026-00042
serviceRequestSchema.pre('save', async function makeTicket() {
  if (this.ticketNo) return;
  // Use the highest existing number (not a count) so deletions never cause duplicates
  const last = await this.constructor.findOne({ ticketNo: { $exists: true } }).sort({ ticketNo: -1 }).select('ticketNo');
  const lastNo = last ? parseInt(last.ticketNo.split('-').pop(), 10) : 0;
  this.ticketNo = `REQ-${new Date().getFullYear()}-${String(lastNo + 1).padStart(5, '0')}`;
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
module.exports.STATUSES = STATUSES;
module.exports.PRIORITIES = PRIORITIES;
