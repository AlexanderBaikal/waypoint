/**
 * Loads the bundled dataset into a Firestore project.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/seed-firestore.mjs
 *
 *   --dry-run   report what would be written and stop
 *   --wipe      delete existing documents in the target collections first
 *
 * The service-account key comes from the Firebase console:
 * Project settings → Service accounts → Generate new private key. It is a
 * secret and must not be committed; .gitignore already covers *-service-account
 * and the file the README suggests.
 *
 * ## Why this writes a different shape than src/data/firestoreLegacy.ts reads
 *
 * The 2021 database split a place across `places` (map pins) and
 * `descriptions` (detail pages), and the two drifted apart. A new project is a
 * chance to not inherit that: one document per place, reviews as a
 * subcollection under the place they belong to. Reading a place's reviews is
 * then one query on one collection with no composite index and no join key —
 * where the legacy schema needed `comments.forPlace` to match a *storage folder
 * name*, which is why four places had lost their reviews entirely.
 */
import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, GeoPoint, getFirestore } from "firebase-admin/firestore";

const read = (name) =>
  JSON.parse(readFileSync(new URL(`../src/data/fixtures/${name}.json`, import.meta.url)));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const wipe = args.includes("--wipe");

/** Firestore caps a batch at 500 operations. */
const BATCH_LIMIT = 500;

const places = read("places");
const reviews = read("reviews");

const reviewsByPlace = new Map();
for (const review of reviews) {
  reviewsByPlace.set(review.placeId, [
    ...(reviewsByPlace.get(review.placeId) ?? []),
    review,
  ]);
}

const orphaned = [...reviewsByPlace.keys()].filter(
  (placeId) => !places.some((place) => place.id === placeId),
);

/** Domain shape → stored shape. Coordinates become a real GeoPoint so the
 *  dataset stays queryable by area later; everything else is already flat. */
const toDocument = (place) => ({
  name: place.name,
  type: place.type,
  coords: new GeoPoint(place.coords.lat, place.coords.lng),
  address: place.address,
  phone: place.phone,
  website: place.website,
  about: place.about,
  cover: place.cover,
  photos: place.photos,
  // Stored flat rather than as a nested map: a null rating and a rating of
  // zero are different things, and flat fields keep that legible in the console.
  ratingValue: place.rating?.value ?? null,
  ratingCount: place.rating?.count ?? 0,
  schedule: place.schedule,
  authorId: place.authorId,
  source: place.id.startsWith("osm-") ? "openstreetmap" : "waypoint",
});

const toReviewDocument = (review) => ({
  author: review.author,
  rating: review.rating,
  text: review.text,
  date: review.date,
  photos: review.photos,
});

console.log(
  [
    `places:          ${places.length}`,
    `reviews:         ${reviews.length}`,
    `places rated:    ${places.filter((p) => p.rating).length}`,
    `orphan reviews:  ${orphaned.length}${orphaned.length ? ` (${orphaned.join(", ")})` : ""}`,
    "",
  ].join("\n"),
);

if (dryRun) {
  console.log("dry run: nothing written");
  process.exit(0);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    "GOOGLE_APPLICATION_CREDENTIALS is not set.\n" +
      "Point it at the service-account JSON from\n" +
      "  Firebase console → Project settings → Service accounts → Generate new private key",
  );
  process.exit(1);
}

const credentials = JSON.parse(
  readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"),
);
initializeApp({ credential: cert(credentials) });
const db = getFirestore();
console.log(`project: ${credentials.project_id}\n`);

/** Commits in chunks, because a batch holds at most 500 operations. */
async function commitAll(operations, label) {
  for (let index = 0; index < operations.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    for (const apply of operations.slice(index, index + BATCH_LIMIT)) apply(batch);
    await batch.commit();
    process.stdout.write(
      `\r${label}: ${String(Math.min(index + BATCH_LIMIT, operations.length))}/${String(operations.length)}`,
    );
  }
  process.stdout.write("\n");
}

if (wipe) {
  // recursiveDelete takes the subcollections with it, which a plain delete
  // would orphan — Firestore keeps subcollections of a deleted document.
  await db.recursiveDelete(db.collection("places"));
  console.log("wiped: places");
}

await commitAll(
  places.map((place) => (batch) => {
    batch.set(db.collection("places").doc(place.id), toDocument(place));
  }),
  "places",
);

await commitAll(
  reviews
    .filter((review) => places.some((place) => place.id === review.placeId))
    .map((review) => (batch) => {
      batch.set(
        db.collection("places").doc(review.placeId).collection("reviews").doc(review.id),
        toReviewDocument(review),
      );
    }),
  "reviews",
);

// A single document the client can read to know what it is looking at without
// counting the collection — and a cheap check that the seed actually landed.
await db.collection("meta").doc("dataset").set({
  placeCount: places.length,
  reviewCount: reviews.length,
  seededAt: FieldValue.serverTimestamp(),
});

console.log("\ndone");
process.exit(0);
