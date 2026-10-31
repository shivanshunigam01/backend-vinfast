const Lead = require('../models/Lead');
const { leadUnassignedMongoFilter, leadAssignedMongoFilter, mergeLeadFilters } = require('./leadUnassigned');
const { websiteDirectLeadMongoFilter } = require('./leadModuleFilters');
const LeadFollowUp = require('../models/LeadFollowUp');
const LeadFavourite = require('../models/LeadFavourite');
const { normalizeStageLabel } = require('../constants/leadStages');
const { getActiveStageLabels } = require('./leadStageService');
const { startOfDay, endOfDay } = require('./crmConversion');
const { appendInterestLevelFilter } = require('./leadInterestLevel');

/** Map raw DB status into an active pipeline stage bucket (legacy + import aliases). */
function bucketPipelineStage(rawStatus, stages) {
  const normalized = normalizeStageLabel(rawStatus || 'Enquiry');
  if (stages.includes(normalized)) return normalized;

  const raw = String(rawStatus || '').trim().toLowerCase();
  if (raw === 'follow up' || raw === 'follow-up') {
    return stages.includes('Interested') ? 'Interested' : 'Enquiry';
  }

  return stages.includes('Enquiry') ? 'Enquiry' : stages[0];
}

async function favouriteLeadIdsForUser(admin, extraStaffIds = null) {
  if (!admin?._id) return [];
  const staffIds = extraStaffIds || [admin._id];
  const rows = await LeadFavourite.find({ staffId: { $in: staffIds } }).select('leadId').lean();
  return rows.map((r) => r.leadId);
}

async function buildCrmLeadStats({ admin, leadQuery, unassignedQuery }) {
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
    const key = bucketPipelineStage(row._id, stages);
    pipeline[key] += row.count;
  }

  const favIds = await favouriteLeadIdsForUser(admin);

  const unassignedScope = unassignedQuery || leadQuery;

  const [
    total,
    unassignedCount,
    assignedCount,
    favouriteCount,
    followUpDueToday,
    followUpOverdue,
    newEnquiries,
    hotCount,
    warmCount,
    coldCount,
    websiteDirectCount,
    websiteUnassignedCount,
  ] = await Promise.all([
    Lead.countDocuments(leadQuery),
    Lead.countDocuments(mergeLeadFilters(unassignedScope, leadUnassignedMongoFilter())),
    Lead.countDocuments(mergeLeadFilters(unassignedScope, leadAssignedMongoFilter())),
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
      status: { $in: ['Enquiry', 'New Lead', 'Contact Attempted'] },
      $or: [{ firstRespondedAt: { $exists: false } }, { firstRespondedAt: null }],
    }),
    Lead.countDocuments(appendInterestLevelFilter(leadQuery, 'HOT')),
    Lead.countDocuments(appendInterestLevelFilter(leadQuery, 'WARM')),
    Lead.countDocuments(appendInterestLevelFilter(leadQuery, 'COLD')),
    Lead.countDocuments(mergeLeadFilters(leadQuery, websiteDirectLeadMongoFilter())),
    Lead.countDocuments(
      mergeLeadFilters(leadQuery, websiteDirectLeadMongoFilter(), leadUnassignedMongoFilter()),
    ),
  ]);

  const scopedLeadIds = await Lead.distinct('_id', openQuery);
  const pendingFollowUps = scopedLeadIds.length
    ? await LeadFollowUp.countDocuments({
        leadId: { $in: scopedLeadIds },
        status: 'pending',
        scheduledAt: { $lte: todayEnd },
      })
    : 0;

  const pipelineTotal = Object.values(pipeline).reduce((sum, n) => sum + (Number(n) || 0), 0);

  return {
    total,
    pipelineTotal,
    unassignedCount,
    assignedCount,
    pipeline,
    stages,
    favouriteCount,
    followUpDueToday,
    followUpOverdue,
    newEnquiries,
    pendingFollowUps,
    hotCount,
    warmCount,
    coldCount,
    websiteDirectCount,
    websiteUnassignedCount,
  };
}

/**
 * Mongo filter: raw `status` values that bucket into one CRM pipeline stage (matches pipeline KPI counts).
 */
async function pipelineStageStatusFilter(targetStage, leadQuery) {
  const stages = await getActiveStageLabels();
  const target = String(targetStage || '').trim();
  if (!target) return { _id: null };

  const rows = await Lead.aggregate([
    { $match: leadQuery },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const statuses = [];
  for (const row of rows) {
    if (bucketPipelineStage(row._id, stages) === target) {
      statuses.push(row._id);
    }
  }
  if (!statuses.length) return { _id: null };
  return { status: { $in: statuses } };
}

module.exports = {
  buildCrmLeadStats,
  favouriteLeadIdsForUser,
  bucketPipelineStage,
  pipelineStageStatusFilter,
};
