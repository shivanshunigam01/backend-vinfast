const { SEO_MODELS } = require('../constants/seoCatalog');
const { formatShowroomAddress, PATNA_SHOWROOM } = require('../constants/seoLocation');

const DEALER_NAME = 'Patliputra VinFast';
const HUB_MODEL_KEY = 'hub';

function showroomLine() {
  return `${DEALER_NAME}, ${formatShowroomAddress(PATNA_SHOWROOM)}. Hours: ${PATNA_SHOWROOM.openingHoursText}.`;
}

function wordish(text) {
  return String(text || '').trim();
}

function buildAnswerBlock(district) {
  const d = district.name;
  const hq = district.headquarters && district.headquarters !== d ? ` (${district.headquarters})` : '';
  return wordish(
    `${DEALER_NAME} is Bihar’s authorised VinFast dealer. Customers in ${d}${hq} get VF 6, VF 7, VF MPV 7 and Limo Green price, EMI and test-drive assistance from the Patna showroom at Paijawa — we do not operate a separate ${d} branch. Book online and the team confirms the next step on WhatsApp.`,
  );
}

function methodologyNote() {
  return 'About this information: prices, range and specifications come from the live model master / SiteConfig. Ex-showroom figures can change. On-road price, EMI and delivery depend on variant, insurer and lender. Certified range is not a real-world guarantee.';
}

function liveModelRows(siteConfig = {}) {
  return SEO_MODELS.map((model) => ({
    key: model.key,
    slug: model.slug,
    name: model.name,
    shortName: model.shortName,
    bodyType: model.bodyType,
    seats: model.seats,
    variants: model.variants,
    price: model.priceKey ? siteConfig[model.priceKey] || null : null,
    range: model.rangeKey ? siteConfig[model.rangeKey] || null : null,
  }));
}

function buildHubFaqs(district, siteConfig = {}) {
  const d = district.name;
  const vf6 = SEO_MODELS.find((m) => m.key === 'vf6');
  const vf7 = SEO_MODELS.find((m) => m.key === 'vf7');
  const vf6Price = vf6?.priceKey ? siteConfig[vf6.priceKey] : null;
  const vf7Price = vf7?.priceKey ? siteConfig[vf7.priceKey] : null;
  const vf6Range = vf6?.rangeKey ? siteConfig[vf6.rangeKey] : null;
  const vf7Range = vf7?.rangeKey ? siteConfig[vf7.rangeKey] : null;

  return [
    {
      question: `Can I book a VinFast test drive in ${d}?`,
      answer: `Yes. ${DEALER_NAME} arranges test-drive assistance for customers from ${d}. Slots are confirmed from the Patna showroom — the nearest physical facility — not a local ${d} branch.`,
    },
    {
      question: `${d} me VinFast test drive kaise book karein?`,
      answer: `Website par Test Drive form kholen, district ${d} select karein, model choose karein aur slot confirm karne ke liye WhatsApp OTP complete karein. Team Patna showroom se call/WhatsApp karegi.`,
    },
    {
      question: 'Where is the VinFast showroom in Bihar?',
      answer: `The only physical authorised showroom we operate is in Patna: ${showroomLine()}`,
    },
    {
      question: `What is the VinFast VF 6 price in Bihar for ${d} buyers?`,
      answer: vf6Price
        ? `Indicative VF 6 ex-showroom pricing currently starts from ${vf6Price}. ${d} on-road cost includes registration, insurance and offers — request a quote. Prices change; see the methodology note.`
        : `Ask ${DEALER_NAME} for the current VF 6 ex-showroom and on-road quote for ${d}. We do not publish a stale locked price here.`,
    },
    {
      question: 'What is the VinFast VF 7 price in Bihar?',
      answer: vf7Price
        ? `Indicative VF 7 ex-showroom pricing currently starts from ${vf7Price}. Confirm the live figure and ${d} on-road extras with our Patna desk.`
        : `VF 7 pricing is held in the model master. Contact the Patna showroom for a current quote for ${d}.`,
    },
    {
      question: 'What is the range of VF 6?',
      answer: vf6Range
        ? `The current certified range listed for VF 6 is ${vf6Range}. Certified and real-world range differ with speed, AC, load and monsoon conditions on ${d} roads.`
        : `Certified VF 6 range is published by variant on the model page and can change. We distinguish brochure range from real-world use.`,
    },
    {
      question: 'What is the range of VF 7?',
      answer: vf7Range
        ? `The current certified range listed for VF 7 is ${vf7Range}. Highway trips from ${d} need a buffer versus the certified figure.`
        : `See the VF 7 model page for variant-wise certified range, then plan ${d} highway legs with a reserve.`,
    },
    {
      question: 'Can I charge a VinFast car at home?',
      answer: `Most owners charge overnight on a compatible AC home charger. Installation depends on your meter, load and society rules in ${d}. Ask our team for current product/program terms — not a guaranteed install.`,
    },
    {
      question: 'What EMI options are available?',
      answer: `Use the EMI calculator for an estimate. Lender-approved EMI, fees and eligibility are separate. ${d} buyers can request finance assistance from the Patna desk.`,
    },
    {
      question: 'Is VinFast service available outside Patna?',
      answer: `Scheduled service and workshop work run from the Patna facility. We assist ${d} owners with booking, parts guidance and travel planning — we do not claim a service centre inside ${d} unless one is later opened and listed here.`,
    },
    {
      question: 'Which is better for me: VF 6 or VF 7?',
      answer: `Choose VF 6 for compact city/family SUV needs and VF 7 when you want a more premium SUV with stronger ADAS and highway presence. Book both at Patna if you travel from ${d}.`,
    },
  ];
}

function generateHubPageContent(district, siteConfig = {}) {
  const d = district.name;
  const hq = district.headquarters && district.headquarters !== district.name ? district.headquarters : null;
  const useCase = district.useCase || `daily and intercity travel around ${hq || d}`;

  return {
    pageType: 'hub',
    districtSlug: district.slug,
    districtName: d,
    modelKey: HUB_MODEL_KEY,
    modelName: 'VinFast lineup',
    path: `/${district.slug}`,
    metaTitle: `VinFast Electric Cars in ${d} | Price & Test Drive Assistance`,
    metaDescription: `VinFast VF 6, VF 7, MPV 7 and Limo Green assistance for ${d} — price, EMI and test drive via Patliputra VinFast, Patna. No separate ${d} showroom.`,
    h1: `VinFast Electric Cars in ${d} - Price, Test Drive & Offers`,
    intro: buildAnswerBlock(district),
    answerBlock: buildAnswerBlock(district),
    methodology: methodologyNote(),
    sections: [
      {
        heading: `How we serve ${d}`,
        body: `${DEALER_NAME} provides sales, test-drive, finance and ownership assistance for ${d}. The nearest actual showroom and service desk is in Patna (${showroomLine()}). We do not list a cloned ${d} store.`,
      },
      {
        heading: `Local use: ${useCase}`,
        body: hq && hq !== d
          ? `Many ${d} buyers travel via ${hq}. Typical use includes ${useCase}. Charge overnight at home when possible and keep a highway reserve for Patna visits.`
          : `Typical ${d} use includes ${useCase}. Overnight home charging covers most days; plan a range buffer for the drive to the Patna showroom.`,
      },
      {
        heading: 'Models, price and range',
        body: 'The table on this page reads from the same model master as the rest of the site. If a price or range cell is blank, ask the desk — we will not invent a number.',
      },
      {
        heading: `Finance, exchange and EMI for ${d}`,
        body: `Estimate EMI on the calculator, then request a lender-reviewed quote. Exchange valuations are case-by-case. Nothing on this page is a sanctioned loan.`,
      },
      {
        heading: `Charging and ownership from ${d}`,
        body: `Home AC charging is the default. Public DC fast charging on Bihar corridors is growing and still uneven. Service appointments are coordinated from Patna.`,
      },
    ],
    faqs: buildHubFaqs(district, siteConfig),
    keywords: [],
  };
}

function generateATierPageContent(district, model, siteConfig = {}) {
  const d = district.name;
  const price = model.priceKey ? siteConfig[model.priceKey] : null;
  const range = model.rangeKey ? siteConfig[model.rangeKey] : null;
  const short = model.shortName;
  const isVf6 = model.key === 'vf6';
  const title = isVf6
    ? `VinFast VF 6 in ${d} | Price, Range & Test Drive`
    : `VinFast VF 7 in ${d} | Price, Range & Test Drive`;

  const answer = wordish(
    `The ${model.name} is available to ${d} buyers through ${DEALER_NAME} in Patna — not a local ${d} showroom. ${
      price ? `Indicative ex-showroom pricing starts from ${price}. ` : ''
    }${range ? `Certified range is listed as ${range}. ` : ''}Book a test drive or EMI assistance online; the nearest physical facility is at Paijawa, NH 30 Bypass, Patna.`,
  );

  return {
    pageType: 'model-a',
    districtSlug: district.slug,
    districtName: d,
    modelKey: model.key,
    modelName: model.name,
    path: `/${district.slug}/${model.slug}`,
    metaTitle: title,
    metaDescription: `${model.name} in ${d}: price, range and test drive assistance from Patliputra VinFast, Patna. Ex-showroom figures follow the live model master.`,
    h1: title.replace(' | ', ' — '),
    intro: answer,
    answerBlock: answer,
    methodology: methodologyNote(),
    sections: [
      {
        heading: `${short} for ${d} drivers`,
        body: `The ${model.name} is ${model.positioning}. ${d} use typically includes ${district.useCase || 'city and highway travel'}. Variants: ${model.variants.join(', ')}.`,
      },
      {
        heading: 'Price and range (live master)',
        body: [
          price ? `Indicative ex-showroom: ${price}.` : 'Ask for the current ex-showroom figure.',
          range ? `Certified range: ${range} (not a real-world guarantee).` : 'Range is published by variant on the model page.',
          'On-road price in your district includes RTO, insurance and offers.',
        ].join(' '),
      },
      {
        heading: 'Test drive, EMI and exchange',
        body: `Pre-select ${d} and ${short} on the test-drive or book-now form. EMI examples are estimates. Exchange is optional and quoted after inspection.`,
      },
      {
        heading: 'Nearest real facility',
        body: showroomLine(),
      },
    ],
    faqs: buildHubFaqs(district, siteConfig).filter((f) =>
      isVf6
        ? !/VF 7 price/i.test(f.question) || /VF 6|test drive|showroom|charge|EMI|service|better/i.test(f.question)
        : true,
    ),
    keywords: [],
  };
}

module.exports = {
  DEALER_NAME,
  HUB_MODEL_KEY,
  generateHubPageContent,
  generateATierPageContent,
  generateDistrictPageContent: generateATierPageContent,
  liveModelRows,
  methodologyNote,
  showroomLine,
};
