const StaffNotification = require('../models/StaffNotification');
const LeadFollowUp = require('../models/LeadFollowUp');
const LeadFavourite = require('../models/LeadFavourite');
const Lead = require('../models/Lead');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const { buildPagination } = require('../utils/queryBuilder');
const { emitStaffNotification, leadHref, displayLeadName } = require('../utils/staffNotifications');
const { startOfDay, endOfDay } = require('../utils/crmConversion');

const HOT_INACTIVE_DAYS = 3;

async function hydrateDueAndOverdue(admin) {
  if (!admin?._id) return;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const dayKey = todayStart.toISOString().slice(0, 10);

  const pending = await LeadFollowUp.find({
    status: 'pending',
    scheduledAt: { $lte: todayEnd },
  })
    .populate({ path: 'leadId', select: 'name assignedTo nextFollowUp' })
    .limit(200)
    .lean();

  for (const fu of pending) {
    const lead = fu.leadId;
    if (!lead?.assignedTo) continue;
    const recipientId = lead.assignedTo;
    const overdue = fu.scheduledAt && new Date(fu.scheduledAt) < todayStart;
    await emitStaffNotification({
      recipientId,
      type: overdue ? 'follow_up_overdue' : 'follow_up_due',
      title: overdue ? 'Follow-up overdue' : 'Follow-up due today',
      body: fu.note,
      customerName: displayLeadName(lead),
      leadId: lead._id,
      href: leadHref(lead._id),
      priority: overdue ? 'urgent' : 'today',
      dedupeKey: `${overdue ? 'fu-overdue' : 'fu-due'}:${fu._id}:${dayKey}`,
      skipSelf: false,
    });
  }

  const cutoff = new Date(now.getTime() - HOT_INACTIVE_DAYS * 24 * 60 * 60 * 1000);
  const favs = await LeadFavourite.find({ staffId: admin._id }).select('leadId').lean();
  if (!favs.length) return;
  const stale = await Lead.find({
    _id: { $in: favs.map((f) => f.leadId) },
    lastActivityAt: { $lt: cutoff },
    status: { $nin: ['Delivered', 'Lost', 'Not Interested'] },
  })
    .select('name lastActivityAt')
    .limit(50)
    .lean();
  for (const lead of stale) {
    await emitStaffNotification({
      recipientId: admin._id,
      type: 'favourite_inactive',
      title: 'HOT lead inactive',
      body: `No activity for ${HOT_INACTIVE_DAYS}+ days`,
      customerName: displayLeadName(lead),
      leadId: lead._id,
      href: leadHref(lead._id),
      priority: 'urgent',
      dedupeKey: `hot-inactive:${lead._id}:${dayKey}`,
      skipSelf: false,
    });
  }
}

exports.listNotifications = asyncHandler(async (req, res) => {
  const recipientId = req.admin._id;
  await hydrateDueAndOverdue(req.admin);

  const { page, limit, skip } = buildPagination(req);
  const query = { recipientId };
  if (String(req.query.unread || '') === '1' || req.query.unread === 'true') {
    query.readAt = null;
  }

  const [docs, total, unread] = await Promise.all([
    StaffNotification.find(query).sort({ createdAt: -1 }).skip(skip).limit(Math.min(limit, 100)).lean(),
    StaffNotification.countDocuments(query),
    StaffNotification.countDocuments({ recipientId, readAt: null }),
  ]);

  return successResponse(res, docs, undefined, 200, { page, limit, total, unread });
});

exports.markRead = asyncHandler(async (req, res) => {
  const doc = await StaffNotification.findOne({ _id: req.params.id, recipientId: req.admin._id });
  if (!doc) {
    return successResponse(res, null, 'Notification not found');
  }
  if (!doc.readAt) {
    doc.readAt = new Date();
    await doc.save();
  }
  return successResponse(res, doc, 'Marked as read');
});

exports.markAllRead = asyncHandler(async (req, res) => {
  const result = await StaffNotification.updateMany(
    { recipientId: req.admin._id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  return successResponse(res, { updated: result.modifiedCount || 0 }, 'All notifications marked as read');
});
