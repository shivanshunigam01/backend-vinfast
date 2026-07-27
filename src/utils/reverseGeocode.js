/**
 * Reverse geocode lat/lng → human-readable address.
 * Uses OpenStreetMap Nominatim by default (no API key).
 * Set GEOCODING_PROVIDER=google + GOOGLE_MAPS_API_KEY for Google.
 */
async function reverseGeocode(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const err = new Error('Valid latitude and longitude are required');
    err.statusCode = 400;
    throw err;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    const err = new Error('Latitude/longitude out of range');
    err.statusCode = 400;
    throw err;
  }

  const provider = String(process.env.GEOCODING_PROVIDER || 'nominatim').toLowerCase();

  if (provider === 'google' && process.env.GOOGLE_MAPS_API_KEY) {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY);
    const res = await fetch(url.toString());
    const json = await res.json();
    if (json.status !== 'OK' || !json.results?.[0]) {
      return {
        lat: latitude,
        lng: longitude,
        formattedAddress: null,
        provider: 'google',
        raw: json,
      };
    }
    return {
      lat: latitude,
      lng: longitude,
      formattedAddress: json.results[0].formatted_address,
      placeId: json.results[0].place_id,
      provider: 'google',
      components: json.results[0].address_components,
    };
  }

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': process.env.GEOCODING_USER_AGENT || 'PatliputraVinFastCRM/1.0',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const err = new Error(`Geocoding failed (${res.status})`);
    err.statusCode = 502;
    throw err;
  }
  const json = await res.json();
  return {
    lat: latitude,
    lng: longitude,
    formattedAddress: json.display_name || null,
    provider: 'nominatim',
    address: json.address || null,
  };
}

module.exports = { reverseGeocode };
