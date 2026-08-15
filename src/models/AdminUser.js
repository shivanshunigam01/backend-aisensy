const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, enum: ['superadmin', 'admin'], default: 'admin' }
  },
  { timestamps: true }
);

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    created_at: doc.createdAt.toISOString()
  };
}

adminUserSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema);
