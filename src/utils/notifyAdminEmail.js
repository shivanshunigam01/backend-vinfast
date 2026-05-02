const nodemailer = require('nodemailer');

let transporter;
let warnedMissingConfig = false;

function escapeHtml(s) {
  if (s == null || s === '') return '—';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWhen(doc) {
  const d = doc.createdAt || new Date();
  try {
    return new Date(d).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(d);
  }
}

function getRecipients() {
  const raw = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getMailFrom() {
  return (
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    ''
  ).trim();
}

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  return transporter;
}

function layoutEmail({ title, subtitle, rows, footer }) {
  const rowsHtml = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:36%;vertical-align:top;font-family:system-ui,-apple-system,sans-serif;">${escapeHtml(r.label)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-family:system-ui,-apple-system,sans-serif;">${r.value}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f8fafc;padding:24px 12px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
    <tr>
      <td style="background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">${escapeHtml(title)}</h1>
        ${subtitle ? `<p style="margin:8px 0 0;color:rgba(255,255,255,0.92);font-size:13px;">${escapeHtml(subtitle)}</p>` : ''}
      </td>
    </tr>
    <tr><td style="padding:0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${rowsHtml}</table>
    </td></tr>
    <tr>
      <td style="padding:16px 20px;background:#f1f5f9;font-size:11px;color:#64748b;line-height:1.5;">
        ${escapeHtml(footer)}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendNotification({ subject, html, text, replyTo }) {
  const to = getRecipients();
  const transport = getTransporter();
  const from = getMailFrom();

  if (!to.length || !transport || !from) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(
        '[mail] Skipping admin notifications: set ADMIN_NOTIFY_EMAIL, SMTP_HOST, MAIL_FROM (or SMTP_FROM), and SMTP credentials if required.'
      );
    }
    return false;
  }

  try {
    await transport.sendMail({
      from,
      to: to.join(', '),
      subject,
      text,
      html,
      replyTo: replyTo || undefined,
    });
    return true;
  } catch (err) {
    console.error('[mail] Failed to send:', err.message);
    return false;
  }
}

function docRow(label, value) {
  const raw = value == null || value === '' ? '' : String(value);
  const display = raw ? escapeHtml(raw) : '<span style="color:#94a3b8;">—</span>';
  return { label, value: display, raw: raw || '—' };
}

/**
 * @param {import('mongoose').Document} lead
 * @returns {Promise<boolean>}
 */
async function notifyNewLead(lead) {
  const o = lead.toObject ? lead.toObject() : lead;
  const cityLine = o.city === 'Other' && o.otherCity ? String(o.otherCity) : o.city;
  const rows = [
    docRow('Submitted', formatWhen(o)),
    docRow('Name', o.name),
    docRow('Mobile', o.mobile),
    docRow('Email', o.email),
    docRow('City / district', cityLine),
    docRow('Model', o.model),
    docRow('Interest', o.interest),
    docRow('Source', o.source),
    docRow('Page / campaign', o.pageSource),
    docRow('Remarks', o.remarks),
    docRow('Finance needed', o.financeNeeded ? 'Yes' : 'No'),
    docRow('Exchange needed', o.exchangeNeeded ? 'Yes' : 'No'),
  ];

  const subject = `[Patliputra VinFast] New lead — ${o.name || 'Website'}`;
  const html = layoutEmail({
    title: 'New lead submission',
    subtitle: 'Patliputra VinFast · CRM',
    rows,
    footer:
      'Automated message from your website forms. Reply if the customer email is present (Reply-To may be set). Do not share this email publicly.',
  });

  const text = `New lead submission\n${rows.map((r) => `${r.label}: ${r.raw}`).join('\n')}`;
  const replyTo =
    o.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(o.email).trim())
      ? String(o.email).trim()
      : undefined;

  return sendNotification({ subject, html, text, replyTo });
}

/**
 * @param {import('mongoose').Document} td
 * @returns {Promise<boolean>}
 */
async function notifyNewTestDrive(td) {
  const o = td.toObject ? td.toObject() : td;
  const pref =
    o.preferredDate != null
      ? `${new Date(o.preferredDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} ${o.preferredTime || ''}`.trim()
      : '—';

  const rows = [
    docRow('Submitted', formatWhen(o)),
    docRow('Customer', o.customerName),
    docRow('Mobile', o.mobile),
    docRow('Email', o.email),
    docRow('City', o.city),
    docRow('Model', o.model),
    docRow('Preferred slot', pref),
    docRow('Branch', o.branch),
    docRow('TD location', o.preferredTestDriveLocation),
    docRow('Owns car', o.ownsCar),
    docRow('Current car', o.currentCarDetails),
    docRow('Purchase timeline', o.purchaseTimeline),
    docRow('Page source', o.pageSource),
    docRow('Remarks', o.remarks),
  ];

  const subject = `[Patliputra VinFast] Test drive request — ${o.customerName || 'Customer'}`;
  const html = layoutEmail({
    title: 'New test drive request',
    subtitle: 'Patliputra VinFast · CRM',
    rows,
    footer: 'Automated message from your website test drive form.',
  });
  const text = `New test drive request\n${rows.map((r) => `${r.label}: ${r.raw}`).join('\n')}`;
  const replyTo =
    o.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(o.email).trim())
      ? String(o.email).trim()
      : undefined;

  return sendNotification({ subject, html, text, replyTo });
}

/**
 * @param {import('mongoose').Document} enq
 * @returns {Promise<boolean>}
 */
async function notifyNewEnquiry(enq) {
  const o = enq.toObject ? enq.toObject() : enq;
  const rows = [
    docRow('Submitted', formatWhen(o)),
    docRow('Name', o.name),
    docRow('Mobile', o.mobile),
    docRow('Email', o.email),
    docRow('City', o.city),
    docRow('Model', o.model),
    docRow('Interest type', o.interest),
    docRow('Source', o.source),
    docRow('Message', o.message),
  ];

  const subject = `[Patliputra VinFast] Enquiry — ${o.name || 'Website'}`;
  const html = layoutEmail({
    title: 'New enquiry',
    subtitle: 'Patliputra VinFast · CRM',
    rows,
    footer: 'Automated message from your website contact / enquiry form.',
  });
  const text = `New enquiry\n${rows.map((r) => `${r.label}: ${r.raw}`).join('\n')}`;
  const replyTo =
    o.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(o.email).trim())
      ? String(o.email).trim()
      : undefined;

  return sendNotification({ subject, html, text, replyTo });
}

module.exports = {
  notifyNewLead,
  notifyNewTestDrive,
  notifyNewEnquiry,
};
