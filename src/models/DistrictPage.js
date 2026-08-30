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
 * District SEO page: hubs (`/{district}`) and selective VF 6 / VF 7 A- pages
 * (`/{district}/{model}`). Leftover mass-generated combos are kept inactive.
 */
const districtPageSchema = new mongoose.Schema(
  {
    pageType: { type: String, enum: ['hub', 'model-a'], default: 'model-a', index: true },
    districtSlug: { type: String, required: true, trim: true, lowercase: true },
    districtName: { type: String, required: true, trim: true },
    modelKey: { type: String, required: true, trim: true, lowercase: true },
    modelName: { type: String, required: true, trim: true },
    path: { type: String, required: true, unique: true, trim: true },

    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    h1: { type: String, trim: true },
    intro: { type: String, trim: true },
    answerBlock: { type: String, trim: true },
    methodology: { type: String, trim: true },
    sections: [sectionSchema],
    keywords: [{ type: String, trim: true }],
    faqs: [faqSchema],

    active: { type: Boolean, default: true },
    customized: { type: Boolean, default: false },
  },
  { timestamps: true }
);

districtPageSchema.index({ districtSlug: 1, modelKey: 1 }, { unique: true });
districtPageSchema.index({ active: 1, pageType: 1, districtSlug: 1 });

module.exports = mongoose.model('DistrictPage', districtPageSchema);
