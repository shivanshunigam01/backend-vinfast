/**
 * Automated customer / staff communication engine.
 * Channels: WhatsApp (AiSensy campaign when configured) + Email (SMTP when configured).
 * Always persists a TDNotification audit row so ops can verify delivery attempts.
 */
const nodemailer = require('nodemailer');
const TDNotification = require('../models/TDNotification');
const { sendOtpViaAisensy } = require('./aisensyCampaign');

const TEMPLATES = {
  REGISTRATION_CONFIRMATION: (d) =>
    `Hi ${d.customerName || 'Customer'}, welcome to Patliputra VinFast. Your registration is confirmed.`,
  TEST_DRIVE_ASSIGNMENT: (d) =>
    `Hi ${d.executiveName || 'Team'}, new test drive assigned. Customer: ${d.customerName}, ${d.date} at ${d.time}. Booking: ${d.bookingId}.`,
  SLOT_CONFIRMATION: (d) =>
    `Hi ${d.customerName || 'Customer'}, your VinFast test drive is confirmed on ${d.date} at ${d.time}. Booking ID: ${d.bookingId}.`,
  TEST_DRIVE_REMINDER: (d) =>
    `Reminder: Your VinFast test drive is on ${d.date} at ${d.time}. Booking ID: ${d.bookingId}.`,
  TEST_DRIVE_COMPLETION: (d) =>
    `Thank you ${d.customerName || 'Customer'}! Your VinFast test drive is complete. We'd love your feedback.`,
  TEST_DRIVE_RESCHEDULE: (d) =>
    `Hi ${d.customerName || 'Customer'}, your test drive has been rescheduled to ${d.date} at ${d.time}. Booking: ${d.bookingId}.`,
  RESCHEDULE_REQUEST_RECEIVED: (d) =>
    `Hi ${d.customerName || 'Customer'}, we received your reschedule request for booking ${d.bookingId}. Our team will confirm a slot shortly.`,
  VEHICLE_BOOKING_CONFIRMATION: (d) =>
    `Hi ${d.customerName || 'Customer'}, your vehicle booking is confirmed. Ref: ${d.bookingId || d.reference || ''}.`,
  VEHICLE_DELIVERY_CONFIRMATION: (d) =>
    `Hi ${d.customerName || 'Customer'}, congratulations! Your VinFast delivery is confirmed for ${d.date || 'the scheduled date'}.`,
  LEAD_ASSIGNMENT: (d) =>
    `Hi ${d.executiveName || 'Team'}, a new lead has been assigned to you: ${d.customerName || 'Customer'} (${d.mobile || ''}).`,
  ASSIGNMENT_PENDING_ACCEPTANCE: (d) =>
    `Hi ${d.executiveName || 'Team'}, please Accept or Reject test drive assignment ${d.bookingId} (${d.customerName}, ${d.date} ${d.time}).`,
  ASSIGNMENT_REJECTED_REQUEUE: (d) =>
    `Alert: Assignment for booking ${d.bookingId} was rejected by ${d.executiveName || 'executive'} and needs reassignment.`,
  ESCALATION: (d) => `Escalation: ${d.message || d.subject || 'Please review'}`,
  CUSTOMER_REQUEST: (d) => `Customer request: ${d.message || ''}`,
  APPROVAL_NOTIFICATION: (d) => `Approval update: ${d.message || d.decision || ''}`,
};

let mailTransporter = null;

function emailEnabled() {
  return process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
}

function getMailer() {
  if (!emailEnabled()) return null;
  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return mailTransporter;
}

function buildMessage(templateKey, payload) {
  const builder = TEMPLATES[templateKey];
  return builder ? builder(payload || {}) : String(templateKey);
}

async function sendEmail({ to, subject, text }) {
  const mailer = getMailer();
  if (!mailer || !to) return { skipped: true, reason: 'email_not_configured' };
  const from =
    process.env.SMTP_FROM ||
    process.env.VINFAST_EMAIL_FROM ||
    `"Patliputra VinFast" <${process.env.SMTP_USER}>`;
  await mailer.sendMail({ from, to, subject, text });
  return { sent: true };
}

/**
 * Best-effort WhatsApp via OTP campaign channel when journey campaign is not configured.
 * Prefer AISENSY_JOURNEY_CAMPAIGN when set; otherwise log + skip real WA for non-OTP templates.
 */
async function sendWhatsAppJourney({ mobile10, displayName, message }) {
  if (process.env.WHATSAPP_JOURNEY_ENABLED !== 'true') {
    return { skipped: true, reason: 'whatsapp_journey_disabled' };
  }
  // Reuse OTP campaign path only when explicitly allowed (template must accept text body params).
  if (process.env.WHATSAPP_JOURNEY_USE_OTP_CAMPAIGN === 'true') {
    const code = String(message || '')
      .replace(/\D/g, '')
      .slice(0, 4) || '0000';
    await sendOtpViaAisensy({
      mobile10,
      displayName: displayName || 'Customer',
      otpCode: code,
    });
    return { sent: true, via: 'otp_campaign_fallback' };
  }
  console.log(`[Notification][WHATSAPP] → ${mobile10}: ${message}`);
  return { skipped: true, reason: 'journey_campaign_not_wired' };
}

async function sendNotification({
  channel,
  recipientType,
  recipientId,
  recipientContact,
  templateKey,
  payload,
  bookingId,
  leadId,
  subject,
}) {
  const message = buildMessage(templateKey, payload);
  const notif = await TDNotification.create({
    recipientType,
    recipientId: recipientId != null ? String(recipientId) : undefined,
    recipientContact,
    channel,
    templateKey,
    subject: subject || templateKey.replace(/_/g, ' '),
    message,
    payload,
    bookingId,
    leadId,
    status: 'PENDING',
  });

  try {
    if (channel === 'EMAIL') {
      const result = await sendEmail({
        to: recipientContact,
        subject: notif.subject,
        text: message,
      });
      if (result.skipped) {
        notif.status = 'SKIPPED';
        notif.error = result.reason;
      } else {
        notif.status = 'SENT';
        notif.sentAt = new Date();
      }
    } else if (channel === 'WHATSAPP') {
      const digits = String(recipientContact || '').replace(/\D/g, '').slice(-10);
      const result = await sendWhatsAppJourney({
        mobile10: digits,
        displayName: payload?.customerName || payload?.executiveName || 'Customer',
        message,
      });
      if (result.skipped) {
        notif.status = 'SKIPPED';
        notif.error = result.reason;
        console.log(`[Notification][WHATSAPP][SKIPPED] ${digits}: ${message}`);
      } else {
        notif.status = 'SENT';
        notif.sentAt = new Date();
      }
    } else {
      console.log(`[Notification][${channel}] → ${recipientContact}: ${message}`);
      notif.status = 'SENT';
      notif.sentAt = new Date();
    }
    await notif.save();
  } catch (err) {
    notif.status = 'FAILED';
    notif.error = err.message || String(err);
    await notif.save();
    console.error(`[Notification][${channel}] failed:`, err.message);
  }

  return notif;
}

function bookingDateTime(booking) {
  const date = booking?.slotDate
    ? new Date(booking.slotDate).toLocaleDateString('en-IN')
    : '';
  return { date, time: booking?.slotTime || '' };
}

async function notifySafe(fn) {
  try {
    await fn();
  } catch (err) {
    console.error('[Notification] workflow error:', err.message);
  }
}

async function notifyCustomerRegistration({ customer }) {
  await notifySafe(async () => {
    const payload = { customerName: customer?.name };
    if (customer?.mobile) {
      await sendNotification({
        channel: 'WHATSAPP',
        recipientType: 'CUSTOMER',
        recipientId: customer._id,
        recipientContact: customer.mobile,
        templateKey: 'REGISTRATION_CONFIRMATION',
        payload,
      });
    }
    if (customer?.email) {
      await sendNotification({
        channel: 'EMAIL',
        recipientType: 'CUSTOMER',
        recipientId: customer._id,
        recipientContact: customer.email,
        templateKey: 'REGISTRATION_CONFIRMATION',
        payload,
      });
    }
  });
}

async function notifySlotConfirmation({ booking, customer }) {
  await notifySafe(async () => {
    const { date, time } = bookingDateTime(booking);
    const payload = {
      customerName: customer?.name || booking?.customerName,
      date,
      time,
      bookingId: booking?.bookingId,
    };
    const mobile = customer?.mobile || booking?.customerMobile;
    const email = customer?.email || booking?.customerEmail;
    if (mobile) {
      await sendNotification({
        channel: 'WHATSAPP',
        recipientType: 'CUSTOMER',
        recipientId: customer?._id,
        recipientContact: mobile,
        templateKey: 'SLOT_CONFIRMATION',
        payload,
        bookingId: booking?._id,
      });
    }
    if (email) {
      await sendNotification({
        channel: 'EMAIL',
        recipientType: 'CUSTOMER',
        recipientId: customer?._id,
        recipientContact: email,
        templateKey: 'SLOT_CONFIRMATION',
        payload,
        bookingId: booking?._id,
      });
    }
  });
}

async function notifyTestDriveAssignment({ booking, executive, customer }) {
  await notifySafe(async () => {
    const { date, time } = bookingDateTime(booking);
    const payload = {
      executiveName: executive?.name,
      customerName: customer?.name || booking?.customerName,
      date,
      time,
      bookingId: booking?.bookingId,
    };
    if (executive?.email) {
      await sendNotification({
        channel: 'EMAIL',
        recipientType: 'EXECUTIVE',
        recipientId: executive._id,
        recipientContact: executive.email,
        templateKey: 'ASSIGNMENT_PENDING_ACCEPTANCE',
        payload,
        bookingId: booking?._id,
      });
    }
  });
}

async function notifyReschedule({ booking, customer, requestOnly = false }) {
  await notifySafe(async () => {
    const { date, time } = bookingDateTime(booking);
    const payload = {
      customerName: customer?.name || booking?.customerName,
      date,
      time,
      bookingId: booking?.bookingId,
    };
    const key = requestOnly ? 'RESCHEDULE_REQUEST_RECEIVED' : 'TEST_DRIVE_RESCHEDULE';
    const mobile = customer?.mobile || booking?.customerMobile;
    const email = customer?.email || booking?.customerEmail;
    if (mobile) {
      await sendNotification({
        channel: 'WHATSAPP',
        recipientType: 'CUSTOMER',
        recipientId: customer?._id,
        recipientContact: mobile,
        templateKey: key,
        payload,
        bookingId: booking?._id,
      });
    }
    if (email) {
      await sendNotification({
        channel: 'EMAIL',
        recipientType: 'CUSTOMER',
        recipientId: customer?._id,
        recipientContact: email,
        templateKey: key,
        payload,
        bookingId: booking?._id,
      });
    }
  });
}

async function notifyTestDriveCompleted({ booking, customer }) {
  await notifySafe(async () => {
    const payload = {
      customerName: customer?.name || booking?.customerName,
      bookingId: booking?.bookingId,
    };
    const mobile = customer?.mobile || booking?.customerMobile;
    if (mobile) {
      await sendNotification({
        channel: 'WHATSAPP',
        recipientType: 'CUSTOMER',
        recipientId: customer?._id,
        recipientContact: mobile,
        templateKey: 'TEST_DRIVE_COMPLETION',
        payload,
        bookingId: booking?._id,
      });
    }
  });
}

async function notifyAssignmentRejected({ booking, executive }) {
  await notifySafe(async () => {
    const payload = {
      executiveName: executive?.name,
      bookingId: booking?.bookingId,
    };
    const opsEmail = process.env.OPS_ESCALATION_EMAIL || process.env.SMTP_USER;
    if (opsEmail) {
      await sendNotification({
        channel: 'EMAIL',
        recipientType: 'ADMIN',
        recipientContact: opsEmail,
        templateKey: 'ASSIGNMENT_REJECTED_REQUEUE',
        payload,
        bookingId: booking?._id,
      });
    }
  });
}

module.exports = {
  TEMPLATES,
  sendNotification,
  notifyCustomerRegistration,
  notifySlotConfirmation,
  notifyTestDriveAssignment,
  notifyReschedule,
  notifyTestDriveCompleted,
  notifyAssignmentRejected,
};
