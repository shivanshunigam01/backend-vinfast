const Lead = require('../models/Lead');
const TestDrive = require('../models/TestDrive');
const Enquiry = require('../models/Enquiry');
const Product = require('../models/Product');
const Offer = require('../models/Offer');
const HeroSlide = require('../models/HeroSlide');
const Banner = require('../models/Banner');
const FAQ = require('../models/FAQ');
const Testimonial = require('../models/Testimonial');
const MediaItem = require('../models/MediaItem');
const SiteConfig = require('../models/SiteConfig');
const DealerSettings = require('../models/DealerSettings');
const Admin = require('../models/Admin');
const cloudinary = require('../config/cloudinary');
const { getAll, getOne, createOne, updateOne, deleteOne } = require('./crudFactory');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { successResponse } = require('../utils/apiResponse');
const { buildDateRange, buildSearchQuery } = require('../utils/queryBuilder');
const { findOpenLeadForCustomer } = require('../utils/pvLeadIntake');

const LEAD_SEARCH_FIELDS = ['name', 'mobile', 'email', 'city', 'model', 'source', 'interest'];

function buildLeadListQuery(req) {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.model) query.model = req.query.model;
  if (req.query.source) query.source = req.query.source;
  const range = buildDateRange(req.query.from, req.query.to);
  if (range) query.createdAt = range;
  return query;
}

exports.getLeads = getAll(Lead, {
  searchFields: LEAD_SEARCH_FIELDS,
  filterMapper: (req) => buildLeadListQuery(req),
  populate: { path: 'assignedTo', select: 'name email' },
});

/** All leads in one response (no pagination) — used by admin leads list & export. */
exports.getAllLeads = asyncHandler(async (req, res) => {
  const query = buildLeadListQuery(req);
  if (req.query.search) {
    Object.assign(query, buildSearchQuery(req.query.search, LEAD_SEARCH_FIELDS));
  }
  const data = await Lead.find(query)
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 });
  return successResponse(res, data, undefined, 200, { total: data.length });
});
exports.getLead = getOne(Lead, 'assignedTo');

/** Duplicate guard: one open lead per mobile (closed Lost/Delivered leads don't block). */
exports.createLead = asyncHandler(async (req, res) => {
  const mobile = String(req.body?.mobile || '').trim();
  if (mobile) {
    const duplicate = await findOpenLeadForCustomer({ mobile });
    if (duplicate) {
      const ref = duplicate.leadId || duplicate.opportunityId || duplicate._id;
      throw new ApiError(
        409,
        `A lead already exists for mobile ${mobile} — ${ref} (stage: ${duplicate.status}). Update the existing lead instead of creating a duplicate.`,
      );
    }
  }
  const doc = await Lead.create(req.body);
  return successResponse(res, doc, 'Created successfully', 201);
});

exports.updateLead = updateOne(Lead);
exports.deleteLead = deleteOne(Lead);

exports.getTestDrives = getAll(TestDrive, {
  searchFields: ['customerName', 'mobile', 'email', 'model', 'city', 'branch'],
  filterMapper: (req) => {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.model) query.model = req.query.model;
    if (req.query.date) {
      const day = new Date(req.query.date);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      query.preferredDate = { $gte: day, $lt: next };
    }
    return query;
  },
});
exports.getTestDrive = getOne(TestDrive, 'assignedExecutive leadId');
exports.updateTestDrive = updateOne(TestDrive);
exports.deleteTestDrive = deleteOne(TestDrive);

exports.getEnquiries = getAll(Enquiry, {
  searchFields: ['name', 'mobile', 'email', 'city', 'model', 'interest', 'message'],
  filterMapper: (req) => {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.type) query.interest = req.query.type;
    return query;
  },
});
exports.getEnquiry = getOne(Enquiry);
exports.updateEnquiry = updateOne(Enquiry);
exports.deleteEnquiry = deleteOne(Enquiry);

exports.getProducts = getAll(Product, { searchFields: ['name', 'slug', 'tagline'] });
exports.getProduct = getOne(Product);
exports.createProduct = createOne(Product);
exports.updateProduct = updateOne(Product);
exports.deleteProduct = deleteOne(Product, false);

exports.getOffers = getAll(Offer, { searchFields: ['title', 'description', 'model', 'type'] });
exports.getOffer = getOne(Offer);
exports.createOffer = createOne(Offer);
exports.updateOffer = updateOne(Offer);
exports.deleteOffer = deleteOne(Offer);

exports.getSlides = getAll(HeroSlide, { searchFields: ['title', 'subtitle', 'badge'] });
exports.createSlide = createOne(HeroSlide);
exports.updateSlide = updateOne(HeroSlide);
exports.deleteSlide = deleteOne(HeroSlide);

exports.reorderSlides = asyncHandler(async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) throw new ApiError(400, 'orderedIds must be an array');
  await Promise.all(
    orderedIds.map((id, index) => HeroSlide.findByIdAndUpdate(id, { order: index + 1 }))
  );
  return successResponse(res, { orderedIds }, 'Slides reordered successfully');
});

exports.getSiteConfig = asyncHandler(async (req, res) => {
  const doc = (await SiteConfig.findOne()) || {};
  return successResponse(res, doc);
});
exports.updateSiteConfig = asyncHandler(async (req, res) => {
  const doc = await SiteConfig.findOneAndUpdate({}, req.body, {
    new: true,
    upsert: true,
    runValidators: true,
  });
  return successResponse(res, doc, 'Site config updated successfully');
});

exports.getBanners = getAll(Banner, { searchFields: ['title', 'subtitle'] });
exports.getBanner = getOne(Banner);
exports.createBanner = createOne(Banner);
exports.updateBanner = updateOne(Banner);
exports.deleteBanner = deleteOne(Banner);

exports.getFaqs = getAll(FAQ, { searchFields: ['question', 'answer', 'category'] });
exports.getFaq = getOne(FAQ);
exports.createFaq = createOne(FAQ);
exports.updateFaq = updateOne(FAQ);
exports.deleteFaq = deleteOne(FAQ);

exports.getTestimonials = getAll(Testimonial, { searchFields: ['name', 'designation', 'quote'] });
exports.getTestimonial = getOne(Testimonial);
exports.createTestimonial = createOne(Testimonial);
exports.updateTestimonial = updateOne(Testimonial);
exports.deleteTestimonial = deleteOne(Testimonial);

exports.getMedia = getAll(MediaItem, { searchFields: ['name', 'tag', 'publicId', 'url'] });
exports.createMedia = asyncHandler(async (req, res) => {
  const doc = await MediaItem.create({ ...req.body, uploadedBy: req.admin._id });
  return successResponse(res, doc, 'Media item created successfully', 201);
});
exports.deleteMedia = asyncHandler(async (req, res) => {
  const doc = await MediaItem.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Media item not found');

  if (doc.publicId && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    await cloudinary.uploader.destroy(doc.publicId, {
      resource_type: doc.resourceType === 'video' ? 'video' : 'image',
    });
  }

  await doc.deleteOne();
  return successResponse(res, doc, 'Media item deleted successfully');
});

exports.getDealerSettings = asyncHandler(async (req, res) => {
  const doc = (await DealerSettings.findOne()) || {};
  return successResponse(res, doc);
});
exports.updateDealerSettings = asyncHandler(async (req, res) => {
  const doc = await DealerSettings.findOneAndUpdate({}, req.body, {
    new: true,
    upsert: true,
    runValidators: true,
  });
  return successResponse(res, doc, 'Dealer settings updated successfully');
});

exports.getAdmins = getAll(Admin, { searchFields: ['name', 'email', 'role'] });
exports.createAdmin = asyncHandler(async (req, res) => {
  const doc = await Admin.create(req.body);
  const safe = await Admin.findById(doc._id).select('-password');
  return successResponse(res, safe, 'Admin created successfully', 201);
});
exports.updateAdmin = asyncHandler(async (req, res) => {
  const allowed = { ...req.body };
  delete allowed.password;
  const doc = await Admin.findByIdAndUpdate(req.params.id, allowed, { new: true, runValidators: true }).select('-password');
  if (!doc) throw new ApiError(404, 'Admin not found');
  return successResponse(res, doc, 'Admin updated successfully');
});
exports.deleteAdmin = asyncHandler(async (req, res) => {
  const doc = await Admin.findByIdAndDelete(req.params.id).select('-password');
  if (!doc) throw new ApiError(404, 'Admin not found');
  return successResponse(res, doc, 'Admin deleted successfully');
});
