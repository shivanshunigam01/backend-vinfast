const Product = require('../models/Product');
const HeroSlide = require('../models/HeroSlide');
const Offer = require('../models/Offer');
const Banner = require('../models/Banner');
const FAQ = require('../models/FAQ');
const Testimonial = require('../models/Testimonial');
const SiteConfig = require('../models/SiteConfig');
const DealerSettings = require('../models/DealerSettings');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');

const defaultSiteConfig = {
  whatsappNumber: '919231445060',
  phoneNumber: '+91 9231445060',
  heroTagline: "Bihar's First VinFast Dealer",
  leadStripTitle: 'Ready to Go Electric?',
  leadStripSubtitle: 'Leave your details and our EV advisor will reach out in 10 minutes.',
  vf7Price: '₹22.99L*',
  vf6Price: '₹18.19L*',
  mpv7Price: '₹24.49L*',
  vf7Range: '532 km',
  vf6Range: '468 km',
};

const defaultDealerSettings = {
  dealerName: 'Patliputra VinFast',
  brand: 'VinFast',
  phone: '+91 9231445060',
  email: 'info@patliputravinfast.com',
  whatsapp: '919231445060',
  address: 'Near Deedarganj Check Post, NH-30, Patna, Bihar - 800009',
  gstNo: '',
  showroomHours: 'Mon–Sat: 9:00 AM – 7:00 PM',
  mapEmbedUrl: '',
};

exports.getSiteConfig = asyncHandler(async (req, res) => {
  let doc = await SiteConfig.findOne();
  if (!doc) doc = await SiteConfig.create(defaultSiteConfig);
  const data = doc.toObject ? doc.toObject() : doc;
  return successResponse(res, {
    ...data,
    features: {
      whatsappOtp: process.env.WHATSAPP_OTP_ENABLED === 'true',
    },
  });
});

exports.getDealerSettings = asyncHandler(async (req, res) => {
  let doc = await DealerSettings.findOne();
  if (!doc) doc = await DealerSettings.create(defaultDealerSettings);
  return successResponse(res, doc);
});

exports.getHeroSlides = asyncHandler(async (req, res) => {
  const data = await HeroSlide.find({ active: true }).sort({ order: 1, createdAt: -1 });
  return successResponse(res, data);
});

exports.getProducts = asyncHandler(async (req, res) => {
  const data = await Product.find({ active: true })
    .select('slug name tagline priceFrom heroImage active order')
    .sort({ order: 1, createdAt: -1 });
  return successResponse(res, data);
});

exports.getProductBySlug = asyncHandler(async (req, res) => {
  const data = await Product.findOne({ slug: req.params.slug.toLowerCase(), active: true });
  if (!data) throw new ApiError(404, 'Product not found');
  return successResponse(res, data);
});

exports.getOffers = asyncHandler(async (req, res) => {
  const query = { active: true };
  if (req.query.model) query.model = req.query.model;
  const data = await Offer.find(query).sort({ validTill: 1, createdAt: -1 });
  return successResponse(res, data);
});

exports.getBanners = asyncHandler(async (req, res) => {
  const data = await Banner.find({ active: true }).sort({ order: 1, createdAt: -1 });
  return successResponse(res, data);
});

exports.getFAQs = asyncHandler(async (req, res) => {
  const query = { active: true };
  if (req.query.category) query.category = req.query.category;
  const data = await FAQ.find(query).sort({ order: 1, createdAt: -1 });
  return successResponse(res, data);
});

exports.getTestimonials = asyncHandler(async (req, res) => {
  const data = await Testimonial.find({ active: true }).sort({ order: 1, createdAt: -1 });
  return successResponse(res, data);
});
