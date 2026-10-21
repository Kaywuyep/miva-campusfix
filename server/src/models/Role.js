const mongoose = require('mongoose');

// Roles are stored as their own collection so permissions can be extended later
const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ['user', 'officer', 'admin'],
    },
    label: { type: String, required: true }, // e.g. "Student/Staff"
    permissions: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
