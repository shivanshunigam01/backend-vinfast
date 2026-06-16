const { body, param, query } = require('express-validator');

const objectIdParam = (field = 'id') => param(field).isMongoId().withMessage(`${field} must be a valid MongoDB ObjectId`);
const emailRule = (field = 'email') => body(field).optional({ checkFalsy: true }).isEmail().withMessage('Please enter a valid email');
const mobileBody = (field = 'mobile') => body(field).trim().matches(/^[6-9]\d{9}$/).withMessage('Mobile number must be 10 digits starting with 6–9');

exports.objectIdParam = objectIdParam;
exports.searchQueryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be positive'),
  query('limit').optional().isInt({ min: 1, max: 5000 }).withMessage('limit must be between 1 and 5000')
];

exports.authLoginValidation = [
  body('email').trim().isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

exports.publicLeadValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  mobileBody(),
  emailRule(),
  body('model').isIn(['VF 6', 'VF 7', 'Both']).withMessage('Model must be VF 6, VF 7, or Both'),
  body('interest').optional().isIn(['Test Drive', 'Price Enquiry', 'Finance', 'General', 'Pre-Booking']).withMessage('Invalid interest'),
  body('source').optional().isIn(['Website', 'Google Ads', 'Meta Ads', 'WhatsApp', 'Walk-in', 'Referral']).withMessage('Invalid source')
];

exports.publicTestDriveValidation = [
  body('customerName').trim().isLength({ min: 2 }).withMessage('Customer name must be at least 2 characters'),
  mobileBody(),
  emailRule(),
  body('model').isIn(['VF 6', 'VF 7']).withMessage('Model must be VF 6 or VF 7'),
  body('preferredDate').isISO8601().withMessage('Preferred date must be valid'),
  body('preferredTime').trim().notEmpty().withMessage('Preferred time is required')
];

exports.publicEnquiryValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  mobileBody(),
  emailRule(),
  body('type').optional().isIn(['General', 'Price', 'Finance', 'Service', 'Complaint', 'Other']).withMessage('Invalid enquiry type')
];

exports.adminLeadUpdateValidation = [
  objectIdParam(),
  body('status').optional().isIn([
    'Enquiry', 'Interested', 'Test Drive Booked', 'Test Drive Completed',
    'Negotiation', 'Booking', 'Delivered', 'Lost',
    'New Lead', 'Contact Attempted', 'Test Drive Scheduled', 'Booked', 'Not Interested'
  ]).withMessage('Invalid lead status'),
  body('assignedTo').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('assignedTo must be valid'),
  body('nextFollowUp').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('nextFollowUp must be a valid date')
];

exports.adminTestDriveUpdateValidation = [
  objectIdParam(),
  body('status').optional().isIn(['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled']).withMessage('Invalid test drive status'),
  body('assignedExecutive').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('assignedExecutive must be valid'),
  body('feedbackRating').optional({ nullable: true }).isInt({ min: 1, max: 5 }).withMessage('feedbackRating must be between 1 and 5')
];

exports.adminEnquiryUpdateValidation = [
  objectIdParam(),
  body('status').optional().isIn(['Open', 'Responded', 'Closed']).withMessage('Invalid enquiry status')
];

exports.productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('slug').optional().trim().notEmpty().withMessage('Product slug cannot be empty'),
  body('active').optional().isBoolean().withMessage('active must be boolean'),
  body('order').optional().isNumeric().withMessage('order must be numeric')
];

exports.offerValidation = [
  body('title').trim().notEmpty().withMessage('Offer title is required'),
  body('type').optional().isIn(['Launch', 'Exchange', 'Finance', 'Accessory', 'Seasonal', 'Other']).withMessage('Invalid offer type'),
  body('validTill').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('validTill must be a valid date')
];

exports.heroSlideValidation = [
  body('title').optional().trim(),
  body('order').optional().isNumeric().withMessage('order must be numeric'),
  body('active').optional().isBoolean().withMessage('active must be boolean')
];

exports.bannerValidation = [
  body('title').optional().trim(),
  body('order').optional().isNumeric().withMessage('order must be numeric'),
  body('active').optional().isBoolean().withMessage('active must be boolean')
];

exports.faqValidation = [
  body('question').trim().notEmpty().withMessage('Question is required'),
  body('answer').trim().notEmpty().withMessage('Answer is required'),
  body('order').optional().isNumeric().withMessage('order must be numeric'),
  body('active').optional().isBoolean().withMessage('active must be boolean')
];

exports.testimonialValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('rating').optional({ nullable: true }).isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('active').optional().isBoolean().withMessage('active must be boolean')
];

exports.mediaValidation = [
  body('url').isURL().withMessage('Valid media url is required'),
  body('name').optional().trim(),
  body('publicId').optional().trim(),
  body('tag').optional().trim()
];

const metaLeadStatuses = ['New Lead', 'Contact Attempted', 'Interested', 'Negotiation', 'Booked', 'Delivered', 'Lost', 'Not Interested'];

exports.metaLeadIdParam = (field = 'id') => param(field).trim().notEmpty().withMessage(`${field} is required`);

exports.metaLeadCreateValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('mobile').trim().notEmpty().withMessage('Mobile is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please enter a valid email'),
  body('status').optional().isIn(metaLeadStatuses).withMessage('Invalid lead status'),
  body('nextFollowUp').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('nextFollowUp must be a valid date'),
  body('financeNeeded').optional().isBoolean().withMessage('financeNeeded must be boolean'),
  body('exchangeNeeded').optional().isBoolean().withMessage('exchangeNeeded must be boolean')
];

exports.metaLeadUpdateValidation = [
  exports.metaLeadIdParam(),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('mobile').optional().trim().notEmpty().withMessage('Mobile cannot be empty'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please enter a valid email'),
  body('status').optional().isIn(metaLeadStatuses).withMessage('Invalid lead status'),
  body('nextFollowUp').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('nextFollowUp must be a valid date'),
  body('financeNeeded').optional().isBoolean().withMessage('financeNeeded must be boolean'),
  body('exchangeNeeded').optional().isBoolean().withMessage('exchangeNeeded must be boolean')
];

exports.metaLeadBulkValidation = [
  body('leads').isArray({ min: 1 }).withMessage('leads must be a non-empty array')
];
