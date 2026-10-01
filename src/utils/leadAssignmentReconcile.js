const Lead = require('../models/Lead');
const TDStaff = require('../models/TDStaff');
const {
  sheetConsultantAssignedMongoFilter,
} = require('./leadUnassigned');
const { resolveSheetConsultantToStaff } = require('./sheetConsultantStaffMatch');
const { toObjectId } = require('./leadAssignment');

/**
 * Copy resolved CRE sheet consultant → assignedTo / assignedToEmail when CRM owner is missing.
 * Fixes imports where SALES CONSULTANT was set but assignment was not linked to User Master.
 */
async function reconcileLeadAssignmentsFromSheet({ limit = 250 } = {}) {
  const staffRows = await TDStaff.find({ active: true }).select('name email designation').lean();
  if (!staffRows.length) return { scanned: 0, updated: 0 };

  const candidates = await Lead.find({
    isDuplicate: { $ne: true },
    $and: [
      {
        $or: [
          { assignedTo: { $exists: false } },
          { assignedTo: null },
        ],
      },
      {
        $or: [
          { assignedToEmail: { $exists: false } },
          { assignedToEmail: null },
          { assignedToEmail: '' },
        ],
      },
      sheetConsultantAssignedMongoFilter(),
    ],
  })
    .select('_id creSheet assignedTo assignedToEmail')
    .limit(limit)
    .lean();

  let updated = 0;
  for (const row of candidates) {
    const consultantRaw = row.creSheet?.salesConsultantName;
    const staff = resolveSheetConsultantToStaff(consultantRaw, staffRows);
    if (!staff?._id) continue;

    const oid = toObjectId(staff._id) || staff._id;
    const res = await Lead.updateOne(
      { _id: row._id },
      {
        $set: {
          assignedTo: oid,
          assignedToEmail: String(staff.email || '').trim().toLowerCase() || undefined,
        },
      },
      { timestamps: false },
    );
    if (res.modifiedCount) updated += 1;
  }

  return { scanned: candidates.length, updated };
}

module.exports = {
  reconcileLeadAssignmentsFromSheet,
};
