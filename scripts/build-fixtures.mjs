/**
 * One-off: converts a Firestore REST snapshot into the repo's offline fixtures.
 * Run from the scratchpad; writes into the Waypoint source tree.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const OUT = "/Users/alex/develop/google-maps-clone/src/data/fixtures";

const read = (name) =>
  JSON.parse(readFileSync(new URL(`./raw-${name}.json`, import.meta.url))).documents ?? [];

/** Firestore REST wraps every scalar in a typed envelope; unwrap it recursively. */
function unwrap(value) {
  if (value === null || value === undefined) return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("geoPointValue" in value) {
    return { lat: value.geoPointValue.latitude, lng: value.geoPointValue.longitude };
  }
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(unwrap);
  if ("mapValue" in value) return unwrapFields(value.mapValue.fields ?? {});
  return null;
}

const unwrapFields = (fields) =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, unwrap(v)]));

const docId = (doc) => doc.name.split("/").pop();

/**
 * The 2021 editor wrote its own input placeholders into the database when a
 * field was left untouched, so "Add website" and friends are absent values.
 */
const PLACEHOLDERS = new Set([
  "add name",
  "add address",
  "add website",
  "add phone number",
  "no website yet",
  "",
]);

const clean = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return PLACEHOLDERS.has(trimmed.toLowerCase()) ? null : trimmed;
};

const slugify = (name) =>
  name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Most rows store a GeoPoint, but a couple were written as a plain [lat, lng]
 * array. Both unwrap to something usable, so both are handled.
 */
const readCoords = (value) => {
  if (!value || typeof value !== "object") return null;
  const [lat, lng] = Array.isArray(value) ? value : [value.lat, value.lng];
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * Opening times were free-text in the old editor, so the data contains typos
 * such as "10;00" and unpadded hours. Anything unparseable becomes null rather
 * than rendering as-is.
 */
function normaliseTime(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2})[^\d](\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Keeps day order stable and drops schedules that carry no usable time. */
function normaliseSchedule(schedule) {
  if (!schedule) return null;
  const result = {};
  for (const day of DAYS) {
    const entry = schedule[day];
    if (!entry) return null;
    const open = normaliseTime(entry.open);
    const close = normaliseTime(entry.close);
    if (!entry.closed && !entry.allDay && (!open || !close)) return null;
    result[day] = {
      open: open ?? "00:00",
      close: close ?? "00:00",
      allDay: Boolean(entry.allDay),
      closed: Boolean(entry.closed),
    };
  }
  return result;
}

const descriptions = new Map(
  read("descriptions").map((doc) => [docId(doc), unwrapFields(doc.fields)]),
);

const comments = read("comments").map((doc) => ({
  id: docId(doc),
  ...unwrapFields(doc.fields),
}));

const photosByPlace = comments.reduce((acc, comment) => {
  const key = comment.forPlace;
  if (!key) return acc;
  acc[key] = [...(acc[key] ?? []), ...(comment.photos ?? [])];
  return acc;
}, {});

/**
 * The two legacy collections drifted apart: `places` holds map markers and
 * `descriptions` holds detail pages, and each contains rows the other lacks.
 * Both carry coordinates, so the fixture is their union keyed by document id.
 */
const summaries = new Map(
  read("places").map((doc) => [docId(doc), unwrapFields(doc.fields)]),
);
const legacyKeys = [...new Set([...summaries.keys(), ...descriptions.keys()])];

const places = legacyKeys
  .map((key) => {
    const summary = summaries.get(key) ?? {};
    const detail = descriptions.get(key) ?? {};
    const name = clean(summary.name) ?? clean(detail.name) ?? clean(key);
    if (!name) return null;
    const gallery = photosByPlace[detail.photoFolder ?? name] ?? [];
    const cover = clean(detail.imageUrl);

    return {
      id: slugify(name),
      name,
      type: clean(summary.type) ?? clean(detail.type) ?? "Other",
      coords: readCoords(summary.coords) ?? readCoords(detail.coords),
      address: clean(detail.address),
      phone: clean(detail.phoneNumber),
      website: clean(detail.website),
      about: clean(detail.about),
      cover,
      photos: [...new Set([cover, ...gallery].filter(Boolean))],
      rating:
        detail.ratingCount > 0
          ? { value: detail.ratingValue ?? 0, count: detail.ratingCount }
          : null,
      schedule: normaliseSchedule(detail.schedule),
      authorId: summary.author ?? detail.author ?? null,
    };
  })
  .filter((place) => place !== null && place.coords !== null)
  .sort((a, b) => a.name.localeCompare(b.name));

/** Reviews referenced places by storage folder, i.e. by their display name. */
const placeIdByLegacyKey = new Map(
  legacyKeys.map((key) => {
    const summary = summaries.get(key) ?? {};
    const detail = descriptions.get(key) ?? {};
    const name = clean(summary.name) ?? clean(detail.name) ?? clean(key) ?? key;
    return [key, slugify(name)];
  }),
);

const reviews = comments
  .map((comment) => ({
    id: comment.id,
    // Reviews were keyed by the storage folder name, which is the place name.
    placeId: placeIdByLegacyKey.get(comment.forPlace) ?? slugify(comment.forPlace ?? ""),
    // Author e-mails are dropped: fixtures ship in a public repository.
    author: {
      name: comment.author?.name ?? "Anonymous",
      photoUrl: comment.author?.photoURL?.startsWith("http")
        ? comment.author.photoURL
        : null,
    },
    rating: comment.value ?? 0,
    text: comment.text ?? "",
    date: comment.date ?? null,
    photos: comment.photos ?? [],
  }))
  // Some reviews point at places that were deleted from both collections.
  .filter((review) => review.text && places.some((place) => place.id === review.placeId))
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/places.json`, `${JSON.stringify(places, null, 2)}\n`);
writeFileSync(`${OUT}/reviews.json`, `${JSON.stringify(reviews, null, 2)}\n`);

console.log(`places:  ${places.length}`);
console.log(`reviews: ${reviews.length}`);
console.log(`types:   ${[...new Set(places.map((p) => p.type))].join(", ")}`);
console.log(
  `orphan reviews: ${reviews.filter((r) => !places.some((p) => p.id === r.placeId)).length}`,
);
