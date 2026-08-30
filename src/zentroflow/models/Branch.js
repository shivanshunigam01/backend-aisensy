const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', required: true, index: true },
    branchCode: { type: String, required: true, trim: true, maxlength: 64 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    geography: {
      city: { type: String, default: '' },
      district: { type: String, default: '' },
      state: { type: String, default: '' },
      pin: { type: String, default: '' },
      territoryCode: { type: String, default: '' }
    },
    managerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfUser', default: null },
    active: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'zf_branches' }
);

branchSchema.index({ tenantId: 1, branchCode: 1 }, { unique: true });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId.toString(),
    branch_code: doc.branchCode,
    name: doc.name,
    geography: doc.geography,
    manager_user_id: doc.managerUserId ? doc.managerUserId.toString() : null,
    active: doc.active,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

branchSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfBranch || mongoose.model('ZfBranch', branchSchema);
