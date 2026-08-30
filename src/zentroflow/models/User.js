const mongoose = require('mongoose');
const { ROLES } = require('../constants');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    role: { type: String, enum: ROLES, required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', default: null, index: true },
    branchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ZfBranch' }],
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    permissions: { type: [String], default: [] }
  },
  { timestamps: true, collection: 'zf_users' }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1 });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    phone: doc.phone || '',
    role: doc.role,
    tenant_id: doc.tenantId ? doc.tenantId.toString() : null,
    branch_ids: (doc.branchIds || []).map((id) => id.toString()),
    status: doc.status,
    permissions: doc.permissions || [],
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

userSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfUser || mongoose.model('ZfUser', userSchema);
