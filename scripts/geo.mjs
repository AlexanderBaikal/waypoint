/** Geometry shared by the import scripts. */

const METRES_PER_DEGREE = 111_320;

/**
 * Distance in metres between two points. Treats the earth as flat, which is
 * accurate to well under a metre over the area of one city.
 */
export function metres(a, b) {
  const lat = (a.lat - b.lat) * METRES_PER_DEGREE;
  const lng =
    (a.lng - b.lng) *
    METRES_PER_DEGREE *
    Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(lat, lng);
}
