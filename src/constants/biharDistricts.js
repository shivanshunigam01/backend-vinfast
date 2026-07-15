/**
 * The 38 official districts of Bihar, used to generate hyperlocal SEO landing
 * pages (district × model). `slug` is the URL segment (e.g. /patna/vinfast-vf6),
 * `headquarters` is used in generated copy when it differs from the district name.
 */
const BIHAR_DISTRICTS = [
  { name: 'Araria', slug: 'araria', headquarters: 'Araria' },
  { name: 'Arwal', slug: 'arwal', headquarters: 'Arwal' },
  { name: 'Aurangabad', slug: 'aurangabad', headquarters: 'Aurangabad' },
  { name: 'Banka', slug: 'banka', headquarters: 'Banka' },
  { name: 'Begusarai', slug: 'begusarai', headquarters: 'Begusarai' },
  { name: 'Bhagalpur', slug: 'bhagalpur', headquarters: 'Bhagalpur' },
  { name: 'Bhojpur', slug: 'bhojpur', headquarters: 'Arrah' },
  { name: 'Buxar', slug: 'buxar', headquarters: 'Buxar' },
  { name: 'Darbhanga', slug: 'darbhanga', headquarters: 'Darbhanga' },
  { name: 'East Champaran', slug: 'east-champaran', headquarters: 'Motihari' },
  { name: 'Gaya', slug: 'gaya', headquarters: 'Gaya' },
  { name: 'Gopalganj', slug: 'gopalganj', headquarters: 'Gopalganj' },
  { name: 'Jamui', slug: 'jamui', headquarters: 'Jamui' },
  { name: 'Jehanabad', slug: 'jehanabad', headquarters: 'Jehanabad' },
  { name: 'Kaimur', slug: 'kaimur', headquarters: 'Bhabua' },
  { name: 'Katihar', slug: 'katihar', headquarters: 'Katihar' },
  { name: 'Khagaria', slug: 'khagaria', headquarters: 'Khagaria' },
  { name: 'Kishanganj', slug: 'kishanganj', headquarters: 'Kishanganj' },
  { name: 'Lakhisarai', slug: 'lakhisarai', headquarters: 'Lakhisarai' },
  { name: 'Madhepura', slug: 'madhepura', headquarters: 'Madhepura' },
  { name: 'Madhubani', slug: 'madhubani', headquarters: 'Madhubani' },
  { name: 'Munger', slug: 'munger', headquarters: 'Munger' },
  { name: 'Muzaffarpur', slug: 'muzaffarpur', headquarters: 'Muzaffarpur' },
  { name: 'Nalanda', slug: 'nalanda', headquarters: 'Bihar Sharif' },
  { name: 'Nawada', slug: 'nawada', headquarters: 'Nawada' },
  { name: 'Patna', slug: 'patna', headquarters: 'Patna' },
  { name: 'Purnia', slug: 'purnia', headquarters: 'Purnia' },
  { name: 'Rohtas', slug: 'rohtas', headquarters: 'Sasaram' },
  { name: 'Saharsa', slug: 'saharsa', headquarters: 'Saharsa' },
  { name: 'Samastipur', slug: 'samastipur', headquarters: 'Samastipur' },
  { name: 'Saran', slug: 'saran', headquarters: 'Chhapra' },
  { name: 'Sheikhpura', slug: 'sheikhpura', headquarters: 'Sheikhpura' },
  { name: 'Sheohar', slug: 'sheohar', headquarters: 'Sheohar' },
  { name: 'Sitamarhi', slug: 'sitamarhi', headquarters: 'Sitamarhi' },
  { name: 'Siwan', slug: 'siwan', headquarters: 'Siwan' },
  { name: 'Supaul', slug: 'supaul', headquarters: 'Supaul' },
  { name: 'Vaishali', slug: 'vaishali', headquarters: 'Hajipur' },
  { name: 'West Champaran', slug: 'west-champaran', headquarters: 'Bettiah' },
];

const districtBySlug = new Map(BIHAR_DISTRICTS.map((d) => [d.slug, d]));

function getDistrictBySlug(slug) {
  return districtBySlug.get(String(slug || '').toLowerCase()) || null;
}

module.exports = { BIHAR_DISTRICTS, getDistrictBySlug };
