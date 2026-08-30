/**
 * The 38 official districts of Bihar.
 * `aTier: true` districts get VF 6 / VF 7 model pages; all districts get a hub.
 * `headquarters` and `useCase` keep hub copy factual and locally distinct.
 */
const A_TIER_SLUGS = [
  'patna',
  'gaya',
  'muzaffarpur',
  'bhagalpur',
  'darbhanga',
  'nalanda',
  'purnia',
  'begusarai',
  'rohtas',
  'saran',
  'vaishali',
  'east-champaran',
];

const BIHAR_DISTRICTS = [
  { name: 'Araria', slug: 'araria', headquarters: 'Araria', useCase: 'Seemanchal travel toward Katihar and the Nepal-adjacent belt' },
  { name: 'Arwal', slug: 'arwal', headquarters: 'Arwal', useCase: 'short hops to Jehanabad and Patna on state highways' },
  { name: 'Aurangabad', slug: 'aurangabad', headquarters: 'Aurangabad', useCase: 'Grand Trunk / NH corridor toward Gaya and Rohtas' },
  { name: 'Banka', slug: 'banka', headquarters: 'Banka', useCase: 'east Bihar routes toward Bhagalpur' },
  { name: 'Begusarai', slug: 'begusarai', headquarters: 'Begusarai', useCase: 'Barauni industrial and NH-31 commuting', aTier: true },
  { name: 'Bhagalpur', slug: 'bhagalpur', headquarters: 'Bhagalpur', useCase: 'east Bihar city driving and river-belt highways', aTier: true },
  { name: 'Bhojpur', slug: 'bhojpur', headquarters: 'Arrah', useCase: 'Arrah–Patna commuting across the Ganga belt' },
  { name: 'Buxar', slug: 'buxar', headquarters: 'Buxar', useCase: 'western Bihar highway travel toward UP' },
  { name: 'Darbhanga', slug: 'darbhanga', headquarters: 'Darbhanga', useCase: 'Mithila region trips and the Patna–Darbhanga corridor', aTier: true },
  { name: 'East Champaran', slug: 'east-champaran', headquarters: 'Motihari', useCase: 'Motihari and north Bihar highway use', aTier: true },
  { name: 'Gaya', slug: 'gaya', headquarters: 'Gaya', useCase: 'Patna–Gaya and Bodh Gaya weekend travel', aTier: true },
  { name: 'Gopalganj', slug: 'gopalganj', headquarters: 'Gopalganj', useCase: 'north-west Bihar routes toward Siwan and UP' },
  { name: 'Jamui', slug: 'jamui', headquarters: 'Jamui', useCase: 'south Bihar stretches toward Munger and Deoghar' },
  { name: 'Jehanabad', slug: 'jehanabad', headquarters: 'Jehanabad', useCase: 'daily travel toward Patna and Gaya' },
  { name: 'Kaimur', slug: 'kaimur', headquarters: 'Bhabua', useCase: 'Bhabua and the western plateau highway' },
  { name: 'Katihar', slug: 'katihar', headquarters: 'Katihar', useCase: 'Seemanchal rail-town commuting and NH-31' },
  { name: 'Khagaria', slug: 'khagaria', headquarters: 'Khagaria', useCase: 'Kosi–Ganga belt travel toward Begusarai' },
  { name: 'Kishanganj', slug: 'kishanganj', headquarters: 'Kishanganj', useCase: 'far-east Bihar routes toward West Bengal' },
  { name: 'Lakhisarai', slug: 'lakhisarai', headquarters: 'Lakhisarai', useCase: 'Kiul junction commuting toward Munger and Patna' },
  { name: 'Madhepura', slug: 'madhepura', headquarters: 'Madhepura', useCase: 'Kosi belt travel toward Saharsa' },
  { name: 'Madhubani', slug: 'madhubani', headquarters: 'Madhubani', useCase: 'Mithila hinterland trips toward Darbhanga' },
  { name: 'Munger', slug: 'munger', headquarters: 'Munger', useCase: 'Ganga-town commuting toward Bhagalpur and Jamalpur' },
  { name: 'Muzaffarpur', slug: 'muzaffarpur', headquarters: 'Muzaffarpur', useCase: 'north Bihar commercial trips and NH-22', aTier: true },
  { name: 'Nalanda', slug: 'nalanda', headquarters: 'Bihar Sharif', useCase: 'Bihar Sharif–Rajgir–Patna corridors', aTier: true },
  { name: 'Nawada', slug: 'nawada', headquarters: 'Nawada', useCase: 'south-central Bihar travel toward Gaya and Nalanda' },
  { name: 'Patna', slug: 'patna', headquarters: 'Patna', useCase: 'city commuting on NH 30 Bypass and district roads', aTier: true },
  { name: 'Purnia', slug: 'purnia', headquarters: 'Purnia', useCase: 'Seemanchal city driving and NH-27', aTier: true },
  { name: 'Rohtas', slug: 'rohtas', headquarters: 'Sasaram', useCase: 'Sasaram and Grand Trunk highway use', aTier: true },
  { name: 'Saharsa', slug: 'saharsa', headquarters: 'Saharsa', useCase: 'Kosi region travel toward Supaul and Madhepura' },
  { name: 'Samastipur', slug: 'samastipur', headquarters: 'Samastipur', useCase: 'rail-town commuting toward Darbhanga and Patna' },
  { name: 'Saran', slug: 'saran', headquarters: 'Chhapra', useCase: 'Chhapra–Patna Ganga-belt commuting', aTier: true },
  { name: 'Sheikhpura', slug: 'sheikhpura', headquarters: 'Sheikhpura', useCase: 'short district hops toward Nalanda and Lakhisarai' },
  { name: 'Sheohar', slug: 'sheohar', headquarters: 'Sheohar', useCase: 'north Bihar rural–town travel toward Sitamarhi' },
  { name: 'Sitamarhi', slug: 'sitamarhi', headquarters: 'Sitamarhi', useCase: 'border-district travel toward Muzaffarpur' },
  { name: 'Siwan', slug: 'siwan', headquarters: 'Siwan', useCase: 'north-west Bihar travel toward Chhapra and Gopalganj' },
  { name: 'Supaul', slug: 'supaul', headquarters: 'Supaul', useCase: 'Kosi belt routes toward Saharsa' },
  { name: 'Vaishali', slug: 'vaishali', headquarters: 'Hajipur', useCase: 'Hajipur–Patna satellite commuting', aTier: true },
  { name: 'West Champaran', slug: 'west-champaran', headquarters: 'Bettiah', useCase: 'Bettiah and far-north highway use toward Nepal' },
].map((d) => ({
  ...d,
  aTier: Boolean(d.aTier),
  serviceability: 'patna-assistance',
}));

const districtBySlug = new Map(BIHAR_DISTRICTS.map((d) => [d.slug, d]));

function getDistrictBySlug(slug) {
  return districtBySlug.get(String(slug || '').toLowerCase()) || null;
}

function isATierDistrict(slug) {
  return A_TIER_SLUGS.includes(String(slug || '').toLowerCase());
}

function isATierModelKey(modelKey) {
  return modelKey === 'vf6' || modelKey === 'vf7';
}

function isIndexableATierPage(districtSlug, modelKey) {
  return isATierDistrict(districtSlug) && isATierModelKey(modelKey);
}

module.exports = {
  BIHAR_DISTRICTS,
  A_TIER_SLUGS,
  getDistrictBySlug,
  isATierDistrict,
  isATierModelKey,
  isIndexableATierPage,
};
