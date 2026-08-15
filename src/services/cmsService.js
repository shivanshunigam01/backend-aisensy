const Cms = require('../models/Cms');
const { CMS_DEFAULTS } = require('../constants/cmsDefaults');

const ARRAY_SECTIONS = new Set(['works', 'case-studies', 'testimonials', 'gallery', 'product-demos', 'faqs']);
const SECTION_MAP = {
  works: 'works',
  'case-studies': 'caseStudies',
  testimonials: 'testimonials',
  gallery: 'gallery',
  'product-demos': 'productDemos',
  faqs: 'faqs'
};

async function getOrCreateCms() {
  let doc = await Cms.findOne({ key: 'main' });
  if (!doc) {
    doc = await Cms.create({ key: 'main', ...CMS_DEFAULTS });
    console.log('[cms] Seeded default CMS document');
  }
  return doc;
}

async function getFullCms() {
  const doc = await getOrCreateCms();
  return Cms.toPublic(doc);
}

async function saveFullCms(body) {
  const doc = await getOrCreateCms();
  const fields = ['hero', 'meta', 'company', 'galleryCategories', 'works', 'caseStudies', 'testimonials', 'gallery', 'productDemos', 'faqs'];
  fields.forEach((f) => {
    if (body[f] !== undefined) doc[f] = body[f];
  });
  await doc.save();
  return Cms.toPublic(doc);
}

async function getSection(slug) {
  const cms = await getFullCms();
  if (slug === 'company') return { section: slug, company: cms.company };
  if (slug === 'hero-seo') return { section: slug, hero: cms.hero, meta: cms.meta };
  const key = SECTION_MAP[slug];
  if (!key) return null;
  const result = { section: slug, items: cms[key] || [] };
  if (slug === 'gallery') result.categories = cms.galleryCategories || [];
  return result;
}

async function saveSection(slug, body) {
  const doc = await getOrCreateCms();
  if (slug === 'company' && body.company) {
    doc.company = body.company;
  } else if (slug === 'hero-seo') {
    if (body.hero) doc.hero = body.hero;
    if (body.meta) doc.meta = body.meta;
  } else {
    const key = SECTION_MAP[slug];
    if (!key || !ARRAY_SECTIONS.has(slug)) return null;
    if (Array.isArray(body.items)) doc[key] = body.items;
    if (slug === 'gallery' && Array.isArray(body.categories)) doc.galleryCategories = body.categories;
  }
  await doc.save();
  return Cms.toPublic(doc);
}

async function seedCmsIfNeeded() {
  await getOrCreateCms();
}

module.exports = { getFullCms, saveFullCms, getSection, saveSection, seedCmsIfNeeded };
