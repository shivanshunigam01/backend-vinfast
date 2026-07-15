const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    heading: { type: String, trim: true },
    body: { type: String, trim: true },
  },
  { _id: false }
);

/**
 * Hyperlocal SEO landing page: one document per district × model combination
 * (38 Bihar districts × 4 models = 152 pages). Content is auto-generated from
 * the SEO catalog at bootstrap and can be hand-edited in the admin panel
 * (`customized: true` protects edits from bulk regeneration).
 */
const districtPageSchema = new mongoose.Schema(
  {
    districtSlug: { type: String, required: true, trim: true, lowercase: true },
    districtName: { type: String, required: true, trim: true },
    modelKey: { type: String, required: true, trim: true, lowercase: true },
    modelName: { type: String, required: true, trim: true },
    /** Frontend path, e.g. /patna/vinfast-vf6 — also used in the sitemap. */
    path: { type: String, required: true, unique: true, trim: true },

    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    h1: { type: String, trim: true },
    intro: { type: String, trim: true },
    sections: [sectionSchema],
    keywords: [{ type: String, trim: true }],
    faqs: [faqSchema],

    active: { type: Boolean, default: true },
    /** True once an admin edits the page; bulk regeneration then skips it. */
    customized: { type: Boolean, default: false },
  },
  { timestamps: true }
);

districtPageSchema.index({ districtSlug: 1, modelKey: 1 }, { unique: true });
districtPageSchema.index({ active: 1, districtSlug: 1 });

module.exports = mongoose.model('DistrictPage', districtPageSchema);
