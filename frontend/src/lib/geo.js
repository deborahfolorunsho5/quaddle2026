// Distance and walking time between two pins.
//
// These are straight-line estimates, not routed paths. A real pedestrian
// routing API would need an account, a key, and a request per listing, and the
// question a student is actually asking is "is this five minutes or thirty",
// which a straight line answers well enough at campus scale. Every string
// below is hedged ("about", "roughly") so the number is not read as a promise.

const EARTH_RADIUS_MILES = 3958.8;

// Slower than the ~3.1 mph flat-ground average, because campus routes bend
// around buildings, wait at crossings, and end with finding the right door.
const WALKING_MPH = 2.8;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance in miles between two {lat, lng} points. */
export function distanceMiles(from, to) {
  if (!from || !to) return null;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  // Clamp before asin: floating point can nudge `a` slightly past 1 for
  // antipodal points, which would make the result NaN.
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Walking time in whole minutes, floored at 1 so nothing reads as "0 min". */
export function walkingMinutes(miles) {
  if (miles == null) return null;
  return Math.max(1, Math.round((miles / WALKING_MPH) * 60));
}

/** "0.4 mi" — vague under a tenth of a mile rather than faking precision. */
export function formatMiles(miles) {
  if (miles == null) return null;
  return miles < 0.1 ? "under 0.1 mi" : `${miles.toFixed(1)} mi`;
}

/** Short form for a listing card: "about 9 min walk". */
export function formatWalk(miles) {
  const minutes = walkingMinutes(miles);
  if (minutes == null) return null;
  return minutes >= 60 ? "over an hour's walk" : `about ${minutes} min walk`;
}

/** Long form for a listing page: "0.4 mi away, about 9 min walk". */
export function formatDistanceAndWalk(miles) {
  if (miles == null) return null;
  return `${formatMiles(miles)} away, ${formatWalk(miles)}`;
}

/** A listing carries a pin only if both halves survived. */
export const pinOf = (listing) =>
  listing?.latitude == null || listing?.longitude == null
    ? null
    : { lat: listing.latitude, lng: listing.longitude };
