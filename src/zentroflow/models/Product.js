const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, required: true, trim: true, maxlength: 64 },
    variants: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    global: { type: Boolean, default: false }
  },
  { timestamps: true, collection: 'zf_products' }
);

productSchema.index({ tenantId: 1, code: 1 }, { unique: true });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId ? doc.tenantId.toString() : null,
    name: doc.name,
    code: doc.code,
    variants: doc.variants || [],
    active: doc.active,
    global: doc.global,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

productSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfProduct || mongoose.model('ZfProduct', productSchema);
