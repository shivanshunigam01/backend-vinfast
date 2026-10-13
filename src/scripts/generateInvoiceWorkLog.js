/**
 * Full Patliputra VinFast delivery log (bugs, features, fixes) → Excel for invoicing.
 *   node src/scripts/generateInvoiceWorkLog.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const BACKEND_REPO = 'https://github.com/shivanshunigam01/backend-vinfast';
const FRONTEND_REPO = 'https://github.com/shivanshunigam01/career-section-nanak';
const BACKEND_DIR = path.join(__dirname, '..', '..');
const FRONTEND_DIR = path.join(BACKEND_DIR, '..', 'career-section-nanak');

const KEYWORD_SECTIONS = [
  [/follow-up|followup|cre sheet|creSheet/i, 'Admin — Follow-ups & CRE sheet'],
  [/lead crm|crm lead|pvlead|intake|duplicate.*mobile|open lead/i, 'Admin — Lead CRM'],
  [/calendar|fullcalendar/i, 'Admin — Calendar'],
  [/detailed report|mtd|mis|team-wise|team assigned|report/i, 'Admin — Reports & MIS'],
  [/test drive|td booking|td module|td executive|td feedback|td report|demo fleet|tdlog/i, 'Admin — Test Drive'],
  [/stock|grn|gate|pdi|purchase order|requisition|vendor|dispatch|vehicle order|stock-to-delivery|allocate/i, 'Admin — Stock & Delivery'],
  [/booking lead|complaint|inbound|outbound/i, 'Admin — Booking & Complaints'],
  [/role|user master|staff|otp|password|designation|allowedModules|sync.*user/i, 'Admin — User Master & Roles'],
  [/meta lead|whatsapp|otp/i, 'Integrations — Meta / WhatsApp OTP'],
  [/cors|dependenc|security|node_modules|\.env/i, 'Infrastructure & Security'],
  [/festive|pricing|offer|mpv|limo|hero|footer|homepage|public site|seo|aeo|bihar|model page|navbar|emi|charging|running cost|calculator/i, 'Public website & Tools'],
  [/action centre|action center|import|export|excel|bulk upload|current format/i, 'Admin — Import / Export & Action Centre'],
  [/customer portal|customer history|pvcustomer|lookup/i, 'CRM — Customer master & history'],
  [/vehicle model|catalog|trim|pricing admin/i, 'Admin — Products & Pricing'],
  [/dashboard|executive self/i, 'Admin — Dashboards'],
  [/feedback|post-delivery/i, 'Admin — Feedback'],
  [/procurement|po /i, 'Admin — Procurement'],
];

const JUNK_RX =
  /^(test|tes+st*|asd+|asds+|asdas+|sdf+|qwe+|gh+|hmj+|iyu+|hjg+|mnb+|bvb|vmj|weff|SEOas|ads|asdASD|adaSASD|thisismebubu|tedtasd|ghvil|,n,asds)$/i;

function isMeaningfulMessage(msg) {
  const m = String(msg || '').trim();
  if (!m) return false;
  if (m.length < 6 && !/^(fix|feat):/i.test(m)) return false;
  if (JUNK_RX.test(m)) return false;
  if (/^test+k?ut?$/i.test(m)) return false;
  if (/^as+das+d*$/i.test(m) && m.length < 20) return false;
  if (/^Update frontend submodule/i.test(m)) return false;
  return true;
}

function classifyType(msg) {
  const m = String(msg);
  if (/^fix:|fix\(|bug|crash|harden|guard|wrong|missing|broken|mismatch|fail/i.test(m)) return 'Bug fix';
  if (/^feat:|^Add |^Implement |^Introduce /i.test(m)) return 'New feature';
  if (/^Remove |revert|rollback/i.test(m)) return 'Removal / rollback';
  if (/^Update |^Align |^Improve |^Show |^Use |^Scope |^Parse |^Return |^Allow |^Expand |^Sync /i.test(m))
    return 'Enhancement';
  return 'Enhancement / maintenance';
}

function classifySection(msg) {
  const m = String(msg);
  for (const [rx, section] of KEYWORD_SECTIONS) {
    if (rx.test(m)) return section;
  }
  return 'Platform — General';
}

function gitLog(repoDir, limit = 500) {
  const out = execSync(`git log --format="%h|%ci|%s" --no-merges -${limit}`, {
    cwd: repoDir,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, dateTime, ...rest] = line.split('|');
      const message = rest.join('|');
      const date = dateTime.slice(0, 10);
      return { sha, dateTime, date, message };
    });
}

function link(repoName, sha) {
  const base = repoName === 'Backend' ? BACKEND_REPO : FRONTEND_REPO;
  return `${base}/commit/${sha}`;
}

/** Product features not always obvious from one-line commit messages */
const MANUAL_FEATURES = [
  {
    repo: 'Frontend',
    section: 'Public website — Total cost / ownership tools',
    type: 'New feature',
    issue: 'EMI Calculator (ownership financing)',
    description:
      'Public EMI calculator: loan amount, down payment, tenure, interest — monthly EMI for VinFast models. Route /emi-calculator with SEO metadata.',
    date: '2026-07-28',
    sha: '18ac080',
    note: 'EMICalculator.tsx — added with CRM portal enhancements',
  },
  {
    repo: 'Frontend',
    section: 'Public website — Total cost / ownership tools',
    type: 'New feature',
    issue: 'EV Running cost calculator (TCO comparison)',
    description:
      'Monthly EV vs petrol SUV running cost comparison (km, kWh/100km, tariff, petrol price). Route /running-cost-calculator.',
    date: '2026-07-28',
    sha: '18ac080',
    note: 'RunningCostCalculator.tsx — total cost of ownership / running cost pillar',
  },
  {
    repo: 'Frontend',
    section: 'Public website — Total cost / ownership tools',
    type: 'New feature',
    issue: 'EV Charging time / cost calculator',
    description:
      'Public charging calculator for session time and cost estimates. Route /charging-calculator.',
    date: '2026-07-28',
    sha: '18ac080',
    note: 'ChargingCalculator.tsx',
  },
  {
    repo: 'Frontend',
    section: 'Public website — Total cost / ownership tools',
    type: 'Enhancement',
    issue: 'Calculator methodology & SEO (Bihar blueprint)',
    description: 'CALCULATOR_METHODOLOGY_NOTE and page SEO for calculator routes under Bihar AEO/SEO rollout.',
    date: '2026-10-03',
    sha: '79d0ea9',
    note: 'seoBlueprint.ts integration',
  },
  {
    repo: 'Frontend',
    section: 'Public website',
    type: 'New feature',
    issue: 'Limo Green & extended model pages',
    description: 'Limo Green product pages, catalog, and public lead/TD flows with multi-model support.',
    date: '2026-07-15',
    sha: '3f35369',
    note: 'Major public + admin drop',
  },
  {
    repo: 'Backend',
    section: 'Admin — Lead CRM',
    type: 'New feature',
    issue: 'Standalone Lead CRM with PVLEAD / PVCUST / PVOPP IDs',
    description: 'Unified PV lead intake, customer parent records, opportunity IDs, executive CRM APIs.',
    date: '2026-06-18',
    sha: '3738939',
    note: 'Foundation CRM module',
  },
];

function rowFromCommit(repoName, c) {
  return {
    Repository: repoName,
    Section: classifySection(c.message),
    Type: classifyType(c.message),
    'Issue / Feature': c.message.slice(0, 120),
    'Work done (summary)': c.message,
    'Commit date (IST)': c.date,
    'Commit ID': c.sha,
    'GitHub link': link(repoName, c.sha),
    Notes: '',
  };
}

function rowFromManual(m) {
  return {
    Repository: m.repo,
    Section: m.section,
    Type: m.type,
    'Issue / Feature': m.issue,
    'Work done (summary)': m.description,
    'Commit date (IST)': m.date,
    'Commit ID': m.sha,
    'GitHub link': link(m.repo, m.sha),
    Notes: m.note || '',
  };
}

const backendCommits = gitLog(BACKEND_DIR, 500).filter((c) => isMeaningfulMessage(c.message));
const frontendCommits = gitLog(FRONTEND_DIR, 500).filter((c) => isMeaningfulMessage(c.message));

const allRows = [
  ...MANUAL_FEATURES.map(rowFromManual),
  ...backendCommits.map((c) => rowFromCommit('Backend', c)),
  ...frontendCommits.map((c) => rowFromCommit('Frontend', c)),
];

// De-dupe exact same repo+sha
const seen = new Set();
const deduped = [];
for (const r of allRows) {
  const key = `${r.Repository}|${r['Commit ID']}|${r['Issue / Feature']}`;
  if (seen.has(key)) continue;
  seen.add(key);
  deduped.push(r);
}

deduped.sort((a, b) => {
  const d = b['Commit date (IST)'].localeCompare(a['Commit date (IST)']);
  if (d !== 0) return d;
  return a.Repository.localeCompare(b.Repository);
});

deduped.forEach((r, i) => {
  r['S.No'] = i + 1;
});

const sectionIndex = new Map();
for (const r of deduped) {
  const k = r.Section;
  sectionIndex.set(k, (sectionIndex.get(k) || 0) + 1);
}
const indexRows = [...sectionIndex.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([section, count], i) => ({
    'S.No': i + 1,
    Section: section,
    'Items (commits/features)': count,
  }));

const cover = [
  { Field: 'Project', Value: 'Patliputra VinFast — Website, CRM, Test Drive, Stock, Reports' },
  { Field: 'Client', Value: 'Patliputra VinFast / Patliputra Group' },
  { Field: 'Prepared by', Value: 'Zentroverse Global Pvt Ltd' },
  { Field: 'Backend repository', Value: BACKEND_REPO },
  { Field: 'Frontend repository', Value: FRONTEND_REPO },
  { Field: 'Document generated (UTC date)', Value: new Date().toISOString().slice(0, 10) },
  {
    Field: 'Scope',
    Value:
      'All meaningful git commits (bugs, features, enhancements) from both repos plus explicit product modules (e.g. EMI / Running cost / Charging calculators). Junk/test-only commits excluded.',
  },
  { Field: 'Total line items', Value: String(deduped.length) },
  {
    Field: 'Public TCO / ownership tools',
    Value: '/emi-calculator · /running-cost-calculator · /charging-calculator',
  },
];

const wb = XLSX.utils.book_new();
const tcoRows = MANUAL_FEATURES.filter((m) => m.section.includes('ownership tools') || m.issue.includes('Calculator'));
tcoRows.push({
  repo: 'Frontend',
  section: 'Public website — Total cost / ownership tools',
  type: 'New feature',
  issue: 'Public website foundation (models, booking, UI)',
  description: 'Initial luxurious VinFast public site shell, model pages, and core customer journeys.',
  date: '2026-03-18',
  sha: '18ca731',
  note: 'Luxurious VinFast UI — baseline storefront',
});

XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cover), 'Cover');
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(tcoRows.map((m, i) => ({ 'S.No': i + 1, ...rowFromManual(m) }))),
  'TCO & Calculators',
);
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(indexRows), 'Summary by section');
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(
    deduped.map((r) => ({
      'S.No': r['S.No'],
      Repository: r.Repository,
      Section: r.Section,
      Type: r.Type,
      'Issue / Feature': r['Issue / Feature'],
      'Work done (summary)': r['Work done (summary)'],
      'Commit date (IST)': r['Commit date (IST)'],
      'Commit ID': r['Commit ID'],
      'GitHub link': r['GitHub link'],
      Notes: r.Notes,
    })),
  ),
  'Full work log',
);

const outPath = path.join(BACKEND_DIR, '..', 'Patliputra-VinFast-Complete-Development-Log.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Written:', path.resolve(outPath));
console.log('Total rows:', deduped.length);
console.log('Backend commits:', backendCommits.length);
console.log('Frontend commits:', frontendCommits.length);
