/**
 * Single source of truth for the only physical VinFast location in Bihar.
 * Do not clone this address onto other district pages as if they have a branch.
 */
const PATNA_SHOWROOM = {
  name: 'Patliputra VinFast',
  brand: 'VinFast',
  streetAddress: 'Plot No. 2421, NH 30, Bypass Road, Paijawa',
  addressLocality: 'Patna',
  addressRegion: 'Bihar',
  postalCode: '800009',
  addressCountry: 'IN',
  telephone: '+919231445060',
  email: undefined,
  openingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  opens: '10:00',
  closes: '20:00',
  openingHoursText: 'Monday–Saturday, 10:00–20:00',
  serviceability: 'patna-assistance',
};

function formatShowroomAddress(showroom = PATNA_SHOWROOM) {
  return `${showroom.streetAddress}, ${showroom.addressLocality}, ${showroom.addressRegion} ${showroom.postalCode}, ${showroom.addressCountry}`;
}

function resolveDealerLocation(dealer = {}) {
  return {
    name: dealer.dealerName || PATNA_SHOWROOM.name,
    brand: dealer.brand || PATNA_SHOWROOM.brand,
    streetAddress: dealer.address || PATNA_SHOWROOM.streetAddress,
    addressLocality: PATNA_SHOWROOM.addressLocality,
    addressRegion: PATNA_SHOWROOM.addressRegion,
    postalCode: PATNA_SHOWROOM.postalCode,
    addressCountry: PATNA_SHOWROOM.addressCountry,
    telephone: dealer.phone || PATNA_SHOWROOM.telephone,
    email: dealer.email || PATNA_SHOWROOM.email,
    openingHoursText: dealer.showroomHours || PATNA_SHOWROOM.openingHoursText,
    opens: PATNA_SHOWROOM.opens,
    closes: PATNA_SHOWROOM.closes,
    openingDays: PATNA_SHOWROOM.openingDays,
  };
}

module.exports = {
  PATNA_SHOWROOM,
  formatShowroomAddress,
  resolveDealerLocation,
};
