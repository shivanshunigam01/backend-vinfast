const Lead = require('../models/Lead');
const LeadFollowUp = require('../models/LeadFollowUp');
const LeadFavourite = require('../models/LeadFavourite');
const { getActiveStageLabels } = require('./leadStageService');
const { startOfDay, endOfDay } = require('./crmConversion');

async function favouriteLeadIdsForUser(admin, extraStaffIds = null) {
  if (!admin?._id) return [];
  const staffIds = extraStaffIds || [admin._id];
  const rows = await LeadFavourite.find({ staffId: { $in: staffIds } }).select('leadId').lean();
  return rows.map((r) => r.leadId);
}

async function buildCrmLeadStats({ admin, leadQuery }) {
  const stages = await getActiveStageLabels();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const openQuery = {
    ...leadQuery,
    status: { $nin: ['Delivered', 'Lost', 'Not Interested'] },
  };

  const pipelineAgg = await Lead.aggregate([
    { $match: leadQuery },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const pipeline = {};
  for (const s of stages) pipeline[s] = 0;
  for (const row of pipelineAgg) {
    const key = row._id || 'Enquiry';
    pipeline[key] = (pipeline[key] || 0) + row.count;
  }

  const favIds = await favouriteLeadIdsForUser(admin);

  const [
    total,
    favouriteCount,
    followUpDueToday,
    followUpOverdue,
    newEnquiries,
  ] = await Promise.all([
    Lead.countDocuments(leadQuery),
    favIds.length
      ? Lead.countDocuments({ ...leadQuery, _id: { $in: favIds } })
      : 0,
    Lead.countDocuments({
      ...openQuery,
      nextFollowUp: { $gte: todayStart, $lte: todayEnd },
    }),
    Lead.countDocuments({
      ...openQuery,
      nextFollowUp: { $lt: todayStart },
    }),
    Lead.countDocuments({
      ...leadQuery,
      status: 'Enquiry',
      $or: [{ firstRespondedAt: { $exists: false } }, { firstRespondedAt: null }],
    }),
  ]);

  const scopedLeadIds = await Lead.distinct('_id', openQuery);
  const pendingFollowUps = scopedLeadIds.length
    ? await LeadFollowUp.countDocuments({
        leadId: { $in: scopedLeadIds },
        status: 'pending',
        scheduledAt: { $lte: todayEnd },
      })
    : 0;

  return {
    total,
    pipeline,
    stages,
    favouriteCount,
    followUpDueToday,
    followUpOverdue,
    newEnquiries,
    pendingFollowUps,
  };
}

module.exports = { buildCrmLeadStats, favouriteLeadIdsForUser };
