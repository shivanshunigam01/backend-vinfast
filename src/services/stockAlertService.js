const VehicleStock = require('../models/VehicleStock');
const GateEntry = require('../models/GateEntry');
const VehicleOrder = require('../models/VehicleOrder');
const VehicleAllocation = require('../models/VehicleAllocation');
const StaffNotification = require('../models/StaffNotification');
const { getOrCreateConfig } = require('../controllers/stockConfigController');

async function notifyRole(recipientRoles, { title, body, href }) {
  if (!recipientRoles?.length) return;
  try {
    const TDStaff = require('../models/TDStaff');
    const staff = await TDStaff.find({
      $or: [
        { role: { $in: recipientRoles } },
        { designation: { $in: recipientRoles } },
      ],
      active: { $ne: false },
    }).select('_id');
    for (const s of staff) {
      await StaffNotification.create({
        staffId: s._id,
        type: 'stock_alert',
        title,
        body,
        href,
        priority: 'high',
      });
    }
  } catch (err) {
    console.error('[stockAlertService]', err.message);
  }
}

async function runStockAlerts() {
  const config = await getOrCreateConfig();
  const now = Date.now();

  for (const rule of config.alertRules || []) {
    if (!rule.enabled) continue;

    if (rule.key === 'grn_pending' && rule.thresholdHours) {
      const cutoff = new Date(now - rule.thresholdHours * 3600000);
      const pending = await GateEntry.countDocuments({ status: 'ARRIVED', arrivalDatetime: { $lt: cutoff } });
      if (pending > 0) {
        await notifyRole(rule.recipientRoles, {
          title: `GRN Pending (${pending})`,
          body: `${pending} gate arrival(s) without GRN completion`,
          href: rule.deepLink || '/admin/stock/grn',
        });
      }
    }

    if (rule.key === 'pdi_pending' && rule.thresholdHours) {
      const cutoff = new Date(now - rule.thresholdHours * 3600000);
      const pending = await VehicleStock.countDocuments({
        vehicleStatus: { $in: ['PDI_PENDING', 'RECEIPT_ACCEPTED'] },
        updatedAt: { $lt: cutoff },
      });
      if (pending > 0) {
        await notifyRole(rule.recipientRoles, {
          title: `PDI Pending (${pending})`,
          body: `${pending} VIN(s) awaiting pre-stock PDI`,
          href: rule.deepLink || '/admin/stock/pre-stock-pdi',
        });
      }
    }

    if (rule.key === 'low_soc') {
      const threshold = rule.thresholdSoc ?? config.socLowThreshold ?? 20;
      const count = await VehicleStock.countDocuments({
        vehicleStatus: 'AVAILABLE',
        lastSoc: { $lt: threshold },
      });
      if (count > 0) {
        await notifyRole(rule.recipientRoles, {
          title: `Low SOC Alert (${count})`,
          body: `${count} VIN(s) below ${threshold}% SOC`,
          href: rule.deepLink || '/admin/stock',
        });
      }
    }

    if (rule.key === 'ageing_60') {
      const count = await VehicleStock.countDocuments({ ageingBucket: { $in: ['61-90', '90+'] }, vehicleStatus: 'AVAILABLE' });
      if (count > 0) {
        await notifyRole(rule.recipientRoles, {
          title: `Stock Ageing 60+ (${count})`,
          body: `${count} VIN(s) aged over 60 days`,
          href: rule.deepLink || '/admin/stock',
        });
      }
    }
  }
}

async function expireReservations() {
  const config = await getOrCreateConfig();
  const now = new Date();
  const allocations = await VehicleAllocation.find({
    status: 'ACTIVE',
    reservationExpiry: { $lt: now },
  });

  for (const alloc of allocations) {
    const stock = await VehicleStock.findById(alloc.vehicleStockId);
    const order = alloc.orderId ? await VehicleOrder.findById(alloc.orderId) : null;
    if (stock && stock.vehicleStatus === 'RESERVED') {
      stock.vehicleStatus = 'AVAILABLE';
      stock.status = 'FRESH_STOCK';
      stock.orderId = undefined;
      stock.leadId = undefined;
      stock.reservationExpiry = undefined;
      await stock.save();
    }
    alloc.status = 'EXPIRED';
    alloc.releasedAt = now;
    await alloc.save();
    if (order && order.stage === 'ALLOCATED') {
      order.stockId = undefined;
      order.vinNo = undefined;
      order.stage = 'AWAITING_STOCK';
      await order.save();
    }
  }
  return { expired: allocations.length, reservationHours: config.reservationExpiryHours };
}

module.exports = { runStockAlerts, expireReservations, notifyRole };
