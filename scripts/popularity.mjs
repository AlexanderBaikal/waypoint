/**
 * Choosing which places make the map. Pure half of the OSM import; the network
 * half is in import-osm.mjs.
 *
 * The city box holds about 3,600 named places and the fixture ships a couple
 * of hundred, so each candidate is scored on how likely somebody is to open a
 * map looking for it. The signals are all recorded by OSM already: an
 * encyclopaedia article, a photograph filed against the place, what kind of
 * place it is, how completely the record is filled in, and how central it is.
 *
 * Ranking on completeness alone (the rule this replaced) measures the mapper
 * rather than the place: it filled the map with whichever tyre fitter had
 * typed in their opening hours.
 */
import { metres } from "./geo.mjs";

/**
 * How much of a destination each kind of place is, on a scale where 6 is what
 * a city puts on a postcard and 0 is the long retail tail. Everyday errands
 * sit in the middle: a pharmacy is nobody's day out, but it is one of the
 * things people most often open a map to find.
 *
 * Kinds are the `key=value` strings import-osm.mjs derives from OSM tags.
 * Anything unlisted scores zero and rides on its other signals.
 */
export const DRAW = {
  "amenity=theatre": 6,
  "tourism=attraction": 6,
  "tourism=museum": 6,

  "amenity=cinema": 5,
  "amenity=university": 5,
  "historic=monument": 5,
  "leisure=park": 5,
  "shop=mall": 5,
  "tourism=gallery": 5,

  "amenity=hospital": 4,
  "amenity=marketplace": 4,
  "historic=memorial": 4,
  "leisure=garden": 4,
  "leisure=stadium": 4,
  "tourism=artwork": 4,

  "amenity=bank": 3,
  "amenity=cafe": 3,
  "amenity=college": 3,
  "amenity=library": 3,
  "amenity=pharmacy": 3,
  "amenity=post_office": 3,
  "amenity=restaurant": 3,
  "shop=department_store": 3,
  "shop=supermarket": 3,
  "tourism=hotel": 3,

  "amenity=bar": 2,
  "amenity=clinic": 2,
  "amenity=fast_food": 2,
  "amenity=fuel": 2,
  "amenity=nightclub": 2,
  "amenity=pub": 2,
  "amenity=school": 2,
  "leisure=fitness_centre": 2,
  "leisure=sports_centre": 2,
  "leisure=swimming_pool": 2,
  "shop=bakery": 2,
  "shop=books": 2,
  "tourism=guest_house": 2,
  "tourism=hostel": 2,

  "amenity=ice_cream": 1,
  "shop=clothes": 1,
  "shop=convenience": 1,
  "shop=florist": 1,
  "shop=jewelry": 1,
  "shop=sports": 1,
  "shop=toys": 1,
};

/** How far out the centre bonus reaches, in metres. */
const CENTRAL_METRES = 4000;

/**
 * How completely the record is filled in. Weak on its own, being what the old
 * rule used by itself, but a place with hours, a phone number and an address is
 * one somebody maintains.
 */
export function detail(place) {
  return (
    (place.schedule ? 2 : 0) +
    (place.phone ? 1 : 0) +
    (place.website ? 1 : 0) +
    (place.address ? 1 : 0) +
    (place.about ? 1 : 0)
  );
}

/**
 * The score, given a built place, the OSM tags it came from, and the middle of
 * the city. Higher ships.
 *
 * A Wikipedia article outweighs everything else here on purpose: there are
 * about thirty such places in this city and every one of them belongs on a map
 * of two hundred.
 */
export function popularity(place, tags = {}, centre) {
  let score = 0;

  if (tags.wikipedia) score += 10;
  else if (tags.wikidata) score += 8;

  // Somebody photographed it and filed the picture against the place. That is
  // a statement about the place, and also how import-photos.mjs finds its best
  // covers.
  if (tags.wikimedia_commons || tags.image) score += 4;

  score += DRAW[place.kind] ?? 0;
  score += detail(place);

  // Part of a chain, or run by somebody named: a going concern rather than a
  // shopfront somebody walked past once.
  if (tags.brand || tags.operator) score += 1;

  // Mapped as an outline rather than a dot, which in practice means a building
  // worth drawing: a mall, a university, a hospital.
  if (place.id.startsWith("osm-w")) score += 1;

  if (centre) {
    const away = metres(place.coords, centre);
    score += Math.max(0, 1 - away / CENTRAL_METRES) * 4;
  }

  return score;
}

/**
 * The `limit` best places, under two ceilings.
 *
 * `cap` is the whole reason this is not a sort followed by a slice. Score
 * alone hands the map to cafés and hotels, the two kinds this city has most of
 * that also score well, and a demo whose Services filter holds four places is
 * worse than one that dropped a café for a post office. Capping by
 * kind rather than by category keeps that judgement in one table (`DRAW`)
 * instead of two.
 *
 * `perName` is the same argument one level down. A chain fills its branches in
 * properly and tags them all with the same brand, so seven of one café and six
 * parcel counters came through the first cut: each defensible on its own, and
 * together a worse map than the seventh-best museum would have made.
 * Branches of a chain carry the same name to the character, which is what this
 * counts.
 *
 * Ties break by name so that two runs of the import produce the same fixture.
 */
export function selectPopular(candidates, { limit, cap = Infinity, perName = Infinity }) {
  const ranked = [...candidates].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  );

  const kinds = new Map();
  const names = new Map();
  const kept = [];
  for (const place of ranked) {
    if (kept.length >= limit) break;
    const name = place.name.trim().toLowerCase();
    const ofKind = kinds.get(place.kind) ?? 0;
    const ofName = names.get(name) ?? 0;
    if (ofKind >= cap || ofName >= perName) continue;
    kinds.set(place.kind, ofKind + 1);
    names.set(name, ofName + 1);
    kept.push(place);
  }
  return kept;
}
