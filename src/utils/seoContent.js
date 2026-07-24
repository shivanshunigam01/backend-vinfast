const { DISTRICT_KEYWORD_TEMPLATES } = require('../constants/seoCatalog');

const DEALER_NAME = 'Patliputra VinFast';

function fillDistrict(template, districtName) {
  return template.replace(/\{district\}/g, districtName);
}

/**
 * Keyword mapping for one district page: model primary keywords + localized
 * model keywords (e.g. "VinFast VF6 Patna") + dealer/category keywords
 * (e.g. "VinFast Dealer Patna") + model intent keywords.
 */
function buildKeywords(district, model) {
  const local = [
    `${model.name} ${district.name}`,
    `${model.name} Price ${district.name}`,
    `${model.name} Test Drive ${district.name}`,
    `${model.name} Booking ${district.name}`,
    `${model.shortName} On Road Price ${district.name}`,
  ];
  const dealer = DISTRICT_KEYWORD_TEMPLATES.map((t) => fillDistrict(t, district.name));
  const all = [...local, ...model.primaryKeywords, ...dealer, ...model.intentKeywords];
  return [...new Set(all)];
}

/**
 * Model + district FAQs, written in natural language for AEO (answer engine
 * optimization). `price`/`range` come from SiteConfig at generation time.
 */
function buildFaqs(district, model, { price, range } = {}) {
  const d = district.name;
  const m = model.name;
  const faqs = [
    {
      question: `What is the price of the ${m} in ${d}?`,
      answer: price
        ? `The ${m} starts at ${price} (ex-showroom). For the latest on-road price in ${d} including insurance, registration and current offers, contact ${DEALER_NAME} or request a quote online.`
        : `For the latest ${m} price and on-road quote in ${d}, contact ${DEALER_NAME} — Bihar's authorised VinFast dealership. Prices include applicable EV benefits and current offers.`,
    },
    {
      question: `Where can I buy the ${m} in ${d}?`,
      answer: `${DEALER_NAME} is Bihar's authorised VinFast dealership and serves customers across ${d}. You can book the ${m} online, request a callback, or visit our showroom in Patna for a guided walkthrough.`,
    },
    {
      question: `Can I book a ${m} test drive in ${d}?`,
      answer: `Yes. ${DEALER_NAME} offers test drives for customers from ${d}. Book a test drive online in under a minute and our team will confirm your slot on WhatsApp.`,
    },
  ];

  if (range) {
    faqs.push({
      question: `What is the driving range of the ${m}?`,
      answer: `The ${m} delivers a certified range of ${range} on a full charge — comfortably covering daily commutes in ${d} and intercity trips across Bihar.`,
    });
  }

  faqs.push(
    {
      question: `What variants of the ${m} are available?`,
      answer:
        model.variants.length > 1
          ? `The ${m} is available in ${model.variants.length} variants: ${model.variants.join(', ')}. Our advisors can help you choose the right variant for your budget and driving needs in ${d}.`
          : `The ${m} is currently offered in the ${model.variants[0]} configuration. Contact ${DEALER_NAME} for detailed specifications and delivery timelines in ${d}.`,
    },
    {
      question: `Is EV financing available for the ${m} in ${d}?`,
      answer: `Yes. ${DEALER_NAME} works with leading banks and NBFCs to offer attractive EV loans with low down payments and quick approvals for customers in ${d}. Use our EMI calculator to estimate your monthly payment.`,
    },
    {
      question: `How do I charge the ${m} in ${d}?`,
      answer: `Every ${m} can be charged at home with a standard AC charger, and supports DC fast charging on highways. Our team guides you through home charger installation in ${d} and shares the public charging map for Bihar.`,
    },
    {
      question: `What warranty does the ${m} come with?`,
      answer: `VinFast offers a comprehensive vehicle warranty along with an extended battery warranty for complete peace of mind. Ask ${DEALER_NAME} for the current warranty terms and service plans available in ${d}.`,
    },
    {
      question: `Does ${DEALER_NAME} provide after-sales service for ${d} customers?`,
      answer: `Yes. ${DEALER_NAME} provides full after-sales support — scheduled service, genuine parts, software updates and roadside assistance — for VinFast owners across ${d} and all of Bihar.`,
    },
    {
      question: `Can I exchange my current car for a ${m}?`,
      answer: `Yes. ${DEALER_NAME} offers exchange benefits on your existing petrol, diesel or CNG car when you upgrade to the ${m}. Get an instant exchange valuation from our team in ${d}.`,
    }
  );

  return faqs;
}

/**
 * Generates the full content payload for one district × model landing page.
 * @param {{name, slug, headquarters}} district
 * @param {object} model - entry from SEO_MODELS
 * @param {object} siteConfig - current SiteConfig document (or {})
 */
function generateDistrictPageContent(district, model, siteConfig = {}) {
  const price = model.priceKey ? siteConfig[model.priceKey] : null;
  const range = model.rangeKey ? siteConfig[model.rangeKey] : null;
  const d = district.name;
  const hq = district.headquarters && district.headquarters !== d ? district.headquarters : null;

  const metaTitle = price
    ? `${model.name} Price in ${d} – From ${price} | ${DEALER_NAME}`
    : `${model.name} in ${d} – Price, Booking & Test Drive | ${DEALER_NAME}`;

  // Kept near Google's ~160-char display limit.
  const metaDescription = price
    ? `${model.name} in ${d} from ${price}${range ? ` with ${range} range` : ''}. On-road price, EMI, offers & test drive booking from ${DEALER_NAME} — Bihar's authorised VinFast dealer.`
    : `Buy the ${model.name} in ${d} — ${model.bodyType.toLowerCase()} with ${model.seats} seats. On-road price, EMI & test drive booking from ${DEALER_NAME}, Bihar's authorised VinFast dealer.`;

  const intro = `Looking for the ${model.name} in ${d}${hq ? ` (${hq})` : ''}? ${DEALER_NAME}, Bihar's first authorised VinFast dealership, brings ${model.name} — ${model.positioning} — to customers across ${d}. ${
    price ? `Prices start from ${price} (ex-showroom)` : 'Attractive introductory prices are available'
  }${range ? ` with a certified range of ${range}` : ''}. Book a test drive online, explore EV finance with low EMIs, and get doorstep guidance on charging, insurance and exchange — all from our expert team.`;

  const sections = [
    {
      heading: `Why choose the ${model.name} in ${d}?`,
      body: `The ${model.name} is ${model.positioning}. As a ${model.seats}-seater ${model.bodyType.toLowerCase()}, it combines low running costs with zero tailpipe emissions — ideal for daily driving in ${d} and highway trips across Bihar. With rising fuel prices, an electric vehicle can cut your monthly running cost dramatically compared to petrol or diesel.`,
    },
    {
      heading: `${model.name} variants${model.variants.length > 1 ? ` — ${model.variants.join(', ')}` : ''}`,
      body:
        model.variants.length > 1
          ? `The ${model.name} is available in ${model.variants.length} variants: ${model.variants.join(', ')}. Each step up adds more features, technology and comfort. Talk to our advisors to find the right variant for your needs and budget in ${d}.`
          : `The ${model.name} is offered in the ${model.variants[0]} configuration, thoughtfully equipped for families and businesses in ${d}.`,
    },
    {
      heading: `EV finance, exchange & insurance in ${d}`,
      body: `${DEALER_NAME} offers end-to-end assistance for ${d} customers — EV loans from leading banks and NBFCs with low down payments, exchange bonuses on your existing car, and competitive EV insurance. Use our EMI calculator to plan your purchase before you visit.`,
    },
    {
      heading: `Charging the ${model.name} in ${d}`,
      body: `Charge at home overnight with an AC home charger, or use DC fast charging for quick top-ups on the highway. Our team helps you with home charger installation in ${d} and shares Bihar's growing public charging network map so you can drive with complete confidence.`,
    },
    {
      heading: `Book a ${model.name} test drive in ${d}`,
      body: `Experience the ${model.name} yourself. Book a test drive online — it takes under a minute — and the ${DEALER_NAME} team will confirm your slot on WhatsApp. Home test drives can be arranged across Bihar, including ${d}.`,
    },
  ];

  return {
    districtSlug: district.slug,
    districtName: d,
    modelKey: model.key,
    modelName: model.name,
    path: `/${district.slug}/${model.slug}`,
    metaTitle,
    metaDescription,
    h1: `${model.name} in ${d} — Price, Variants, Range & Test Drive`,
    intro,
    sections,
    keywords: buildKeywords(district, model),
    faqs: buildFaqs(district, model, { price, range }),
  };
}

module.exports = { generateDistrictPageContent, DEALER_NAME };
