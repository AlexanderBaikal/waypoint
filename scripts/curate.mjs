/**
 * Guarding the hand-entered places. Pure half of the OSM import, like
 * popularity.mjs; the network half is in import-osm.mjs.
 *
 * Those places are copied through every re-import untouched — that is how
 * their photographs, ratings and reviews survive one — and so anything wrong
 * with them survives too. Nothing else in the pipeline ever looks at them.
 *
 * Every rule here is something that actually shipped: a park in Panama left
 * over from testing the editor, which stretched the map to two continents the
 * moment anyone filtered to Leisure; the 2021 editor's own input placeholders
 * stored as values, so a place claimed its phone number was "No data yet";
 * opening times of 01:02 to 01:02; and photographs in the Cloud Storage bucket
 * this project has since retired, every one of which now answers 402.
 */

/** The bucket the project dropped. Nothing may link into it again. */
const RETIRED_BUCKET = /firebasestorage\.googleapis\.com/i;

/** What the old editor wrote into a field nobody filled in. */
const PLACEHOLDER =
  /^(add (name|address|website|phone number)|no (website|phone number|data)( yet)?)$/i;

/** A bare hostname, in any script: half the .рф domains here are written so. */
const HOSTNAME = /^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+/u;

/** A field the editor may have left its own prompt in. */
export function field(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && !PLACEHOLDER.test(trimmed) ? trimmed : null;
}

export function asLink(value) {
  const raw = field(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  // Bare hostnames are common in the data and are still usable as links.
  return HOSTNAME.test(raw) ? `https://${raw}` : null;
}

/** A picture has to be fetchable, and on a host still serving it. */
export function photo(value) {
  const link = field(value);
  return link && /^https:\/\//i.test(link) && !RETIRED_BUCKET.test(link) ? link : null;
}

/**
 * A day open from 01:02 to 01:02 is not an opening time, and one such day is
 * enough to make the week untrustworthy — the same call src/data/normalise.ts
 * makes when it reads the legacy database.
 */
export function soundSchedule(schedule) {
  if (!schedule) return null;
  const days = Object.values(schedule);
  return days.some((day) => day && !day.closed && !day.allDay && day.open === day.close)
    ? null
    : schedule;
}

/**
 * Sorts the hand-entered places into the ones the fixture keeps and the ones
 * it drops, scrubbing the fields of the ones it keeps. `box` is the same
 * bounding box the Overpass query uses, so a place the import could not have
 * found is a place that does not belong in the file.
 */
export function curate(places, box) {
  const rejected = [];
  const curated = [];

  for (const place of places) {
    const { lat, lng } = place.coords;
    if (lat < box.south || lat > box.north || lng < box.west || lng > box.east) {
      rejected.push(`${place.id}: ${String(lat)},${String(lng)} is not in the city`);
      continue;
    }

    curated.push({
      ...place,
      address: field(place.address),
      phone: field(place.phone),
      website: asLink(place.website),
      about: field(place.about),
      cover: photo(place.cover),
      photos: place.photos.map(photo).filter(Boolean),
      schedule: soundSchedule(place.schedule),
    });
  }

  return { curated, rejected };
}
