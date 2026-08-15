const mongoose = require('mongoose');

const cmsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    hero: {
      headline: { type: String, default: '' },
      tagline: { type: String, default: '' },
      subheadline: { type: String, default: '' }
    },
    meta: {
      title: { type: String, default: '' },
      description: { type: String, default: '' }
    },
    company: { type: mongoose.Schema.Types.Mixed, default: {} },
    galleryCategories: { type: [String], default: [] },
    works: { type: [mongoose.Schema.Types.Mixed], default: [] },
    caseStudies: { type: [mongoose.Schema.Types.Mixed], default: [] },
    testimonials: { type: [mongoose.Schema.Types.Mixed], default: [] },
    gallery: { type: [mongoose.Schema.Types.Mixed], default: [] },
    productDemos: { type: [mongoose.Schema.Types.Mixed], default: [] },
    faqs: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

function toPublic(doc) {
  return {
    hero: doc.hero || {},
    meta: doc.meta || {},
    company: doc.company || {},
    galleryCategories: doc.galleryCategories || [],
    works: doc.works || [],
    caseStudies: doc.caseStudies || [],
    testimonials: doc.testimonials || [],
    gallery: doc.gallery || [],
    productDemos: doc.productDemos || [],
    faqs: doc.faqs || [],
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null
  };
}

cmsSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.Cms || mongoose.model('Cms', cmsSchema);
