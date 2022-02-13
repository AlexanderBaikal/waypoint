/**
 * Fills the map with real places.
 *
 * Pulls named points of interest for the demo city out of OpenStreetMap via
 * Overpass and rewrites src/data/fixtures/places.json. Anything in that file
 * that did not come from OSM is preserved: the hand-entered places carry the
 * ratings and reviews.
 *
 *   node scripts/import-osm.mjs              fetch and rewrite
 *   node scripts/import-osm.mjs --raw f.json use a saved Overpass response
 *   node scripts/import-osm.mjs --dry-run    report without writing
 *
 * OSM data is ODbL: the basemap attribution the app already shows credits
 * OpenStreetMap, which is what that licence asks of us.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { asLink, curate } from "./curate.mjs";
import { metres } from "./geo.mjs";
import { parseOpeningHours } from "./opening-hours.mjs";
import { popularity, selectPopular } from "./popularity.mjs";

const PLACES = new URL("../src/data/fixtures/places.json", import.meta.url);

/** Irkutsk, the city the original dataset is in. south,west,north,east */
const BBOX = "52.20,104.15,52.36,104.42";

/**
 * How many places the fixture imports. The box holds about 3,600 named ones,
 * and everything under the line is dropped least-popular-first by the ranking
 * in popularity.mjs. With the hand-entered places that survive curate.mjs,
 * this is the 199 the map shows.
 *
 * The number is a judgement about legibility rather than about bytes: 200 pins
 * is a city somebody can read. A Firestore deployment can take the whole
 * import.
 */
const LIMIT = Number(process.env.WAYPOINT_IMPORT_LIMIT ?? 180);

/**
 * No one kind may take more than a fifteenth of the map, twelve places at the
 * shipped limit. Without it the top of the ranking is cafés and hotels all the
 * way down; see selectPopular.
 */
const kindCap = (limit) => Math.max(1, Math.ceil(limit / 15));

/** And no chain more than this many branches. See selectPopular. */
const MAX_BRANCHES = 2;

/**
 * The middle of town, taken as the middle of the box drawn around it. That is
 * within a few hundred metres of Kirov Square, and the ranking only asks how
 * far out a place is in kilometres.
 */
const [SOUTH, WEST, NORTH, EAST] = BBOX.split(",").map(Number);
const CENTRE = { lat: (SOUTH + NORTH) / 2, lng: (WEST + EAST) / 2 };

/** Two places this close together with the same name are the same place. */
const DUPLICATE_METRES = 150;

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const SELECTORS = [
  'node["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|bakery|nightclub|pharmacy|hospital|clinic|doctors|dentist|bank|atm|post_office|fuel|car_wash|cinema|theatre|library|university|college|school|driving_school|marketplace|veterinary)$"]',
  'way["amenity"~"^(restaurant|cafe|bar|pub|fast_food|cinema|theatre|library|university|college|school|hospital|marketplace)$"]',
  'node["shop"]',
  'way["shop"]',
  'node["tourism"~"^(hotel|hostel|motel|guest_house|museum|attraction|gallery|artwork)$"]',
  'way["tourism"~"^(hotel|hostel|motel|guest_house|museum|attraction|gallery)$"]',
  'node["leisure"~"^(fitness_centre|sports_centre|park|garden|playground|stadium|swimming_pool)$"]',
  'way["leisure"~"^(fitness_centre|sports_centre|park|garden|playground|stadium|swimming_pool)$"]',
  'node["office"~"^(company|it|coworking|travel_agent|estate_agent)$"]',
  'node["historic"]',
];

/**
 * OSM tag to the free-text type the app displays. src/domain/categories.ts
 * maps those strings on to the eight categories the UI filters by; a test
 * there reads this fixture back and fails if too much of it lands in "other",
 * which is what happens when this table and that one drift apart.
 */
const TYPES = {
  "amenity=atm": "ATM",
  "amenity=bank": "Bank",
  "amenity=bar": "Bar",
  "amenity=cafe": "Cafe",
  "amenity=car_wash": "Car wash",
  "amenity=cinema": "Movie theater",
  "amenity=clinic": "Clinic",
  "amenity=college": "College",
  "amenity=dentist": "Dentist",
  "amenity=doctors": "Doctor's office",
  "amenity=driving_school": "Driving school",
  "amenity=fast_food": "Fast food",
  "amenity=fuel": "Gas station",
  "amenity=hospital": "Hospital",
  "amenity=ice_cream": "Ice cream shop",
  "amenity=library": "Library",
  "amenity=marketplace": "Market",
  "amenity=nightclub": "Nightclub",
  "amenity=pharmacy": "Pharmacy",
  "amenity=post_office": "Post office",
  "amenity=pub": "Pub",
  "amenity=restaurant": "Restaurant",
  "amenity=school": "School",
  "amenity=theatre": "Theatre",
  "amenity=university": "University",
  "amenity=veterinary": "Veterinary clinic",

  "historic=memorial": "Memorial",
  "historic=monument": "Monument",

  "leisure=fitness_centre": "Gym",
  "leisure=garden": "Garden",
  "leisure=park": "Park",
  "leisure=playground": "Playground",
  "leisure=sports_centre": "Sports club",
  "leisure=stadium": "Stadium",
  "leisure=swimming_pool": "Swimming pool",

  "office=coworking": "Coworking space",
  "office=estate_agent": "Estate agency",
  "office=it": "IT company",
  "office=travel_agent": "Travel agency",

  "shop=agrarian": "Farm supply shop",
  "shop=alcohol": "Off-licence",
  "shop=bakery": "Bakery",
  "shop=bathroom_furnishing": "Bathroom shop",
  "shop=beauty": "Beauty salon",
  "shop=bookmaker": "Betting shop",
  "shop=brewing_supplies": "Home brewing shop",
  "shop=butcher": "Butcher shop",
  "shop=car": "Car dealership",
  "shop=chemist": "Drugstore",
  "shop=clothes": "Clothing shop",
  "shop=confectionery": "Confectionery shop",
  "shop=convenience": "Convenience store",
  "shop=copyshop": "Copy shop",
  "shop=cosmetics": "Cosmetics shop",
  "shop=department_store": "Department store",
  "shop=doityourself": "Hardware shop",
  "shop=dry_cleaning": "Dry cleaner",
  "shop=e-cigarette": "Vape shop",
  "shop=erotic": "Adult shop",
  "shop=fashion_accessories": "Accessories shop",
  "shop=florist": "Florist",
  "shop=funeral_directors": "Funeral home",
  "shop=furniture": "Furniture shop",
  "shop=garden_centre": "Garden centre",
  "shop=greengrocer": "Greengrocer",
  "shop=hairdresser": "Barber shop",
  "shop=hardware": "Hardware shop",
  "shop=hearing_aids": "Hearing aid shop",
  "shop=hifi": "Hi-fi shop",
  "shop=household_linen": "Linen shop",
  "shop=houseware": "Homeware shop",
  "shop=jewelry": "Jewellery shop",
  "shop=mall": "Shopping mall",
  "shop=massage": "Massage salon",
  "shop=mobile_phone": "Phone shop",
  "shop=money_lender": "Loan office",
  "shop=musical_instrument": "Music shop",
  "shop=nutrition_supplements": "Supplements shop",
  "shop=optician": "Optician",
  "shop=pawnbroker": "Pawn shop",
  "shop=perfumery": "Perfumery",
  "shop=pet": "Pet shop",
  "shop=pet_grooming": "Pet grooming salon",
  "shop=plant_hire": "Equipment rental",
  "shop=printer_ink": "Printer supplies shop",
  "shop=pyrotechnics": "Fireworks shop",
  "shop=radiotechnics": "Electronics shop",
  "shop=rental": "Rental service",
  "shop=second_hand": "Second-hand shop",
  "shop=sewing": "Haberdashery",
  "shop=shoes": "Shoe shop",
  "shop=sports": "Sporting goods store",
  "shop=supermarket": "Supermarket",
  "shop=tailor": "Tailor",
  "shop=tattoo": "Tattoo studio",
  "shop=ticket": "Ticket office",
  "shop=tiles": "Tile shop",
  "shop=toys": "Toy shop",
  "shop=travel_agency": "Travel agency",
  "shop=variety_store": "Variety store",
  "shop=water_filter": "Water filter shop",
  "shop=window_blind": "Blinds shop",

  "tourism=artwork": "Public artwork",
  "tourism=attraction": "Tourist attraction",
  "tourism=gallery": "Art gallery",
  "tourism=guest_house": "Bed & breakfast",
  "tourism=hostel": "Hostel",
  "tourism=hotel": "Hotel",
  "tourism=motel": "Motel",
  "tourism=museum": "Museum",
};

/** Where an unlisted tag lands, by its top-level key. */
const FALLBACK_TYPE = {
  shop: (value) => `${humanise(value)} shop`,
  amenity: humanise,
  leisure: humanise,
  tourism: humanise,
  office: (value) => `${humanise(value)} office`,
  historic: humanise,
};

/**
 * Kinds worth skipping rather than showing. Parcel lockers and unnamed company
 * offices are real, but they arrive in hundreds under a handful of repeated
 * brand names and would drown the search results without adding a place anyone
 * would look for.
 */
const SKIP = new Set(["shop=outpost", "office=company", "shop=vacant"]);

const KEYS = ["amenity", "shop", "tourism", "leisure", "office", "historic"];

function humanise(value) {
  const words = value.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function kindOf(tags) {
  for (const key of KEYS) {
    // A place that is two things at once ("clothes;security") is filed under
    // the first, which is the one mappers list as primary.
    const value = clean(tags[key]);
    if (value && value !== "no") return `${key}=${value}`;
  }
  return null;
}

function typeOf(kind) {
  const named = TYPES[kind];
  if (named) return named;
  const [key, value] = kind.split("=");
  return FALLBACK_TYPE[key]?.(value) ?? "Other";
}

const clean = (value) => {
  if (typeof value !== "string") return null;
  // Several tags hold multiple values separated by semicolons; take the first.
  const trimmed = value.split(";")[0].trim();
  return trimmed || null;
};

function addressOf(tags) {
  const street = clean(tags["addr:street"]);
  if (!street) return null;
  const number = clean(tags["addr:housenumber"]);
  const city = clean(tags["addr:city"]);
  return [number ? `${street} ${number}` : street, city].filter(Boolean).join(", ");
}

function websiteOf(tags) {
  return asLink(clean(tags.website) ?? clean(tags["contact:website"]));
}

const normaliseName = (name) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function toPlace(element) {
  const tags = element.tags ?? {};
  const name = clean(tags.name);
  if (!name) return null;

  const kind = kindOf(tags);
  if (!kind || SKIP.has(kind)) return null;

  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const place = {
    id: `osm-${element.type[0]}${element.id}`,
    name,
    kind,
    type: typeOf(kind),
    coords: { lat: round(lat), lng: round(lng) },
    address: addressOf(tags),
    phone: clean(tags.phone) ?? clean(tags["contact:phone"]),
    website: websiteOf(tags),
    about: clean(tags.description) ?? clean(tags["description:en"]),
    cover: null,
    coverCredit: null,
    photos: [],
    // Ratings are earned by reviews. OSM has none, and inventing them would
    // make every other number in this app suspect.
    rating: null,
    schedule: parseOpeningHours(tags.opening_hours),
    authorId: null,
  };

  // Scored here, where the raw tags are still in hand; `score` and `kind` are
  // import bookkeeping and come off again before the fixture is written.
  return { ...place, score: popularity(place, tags, CENTRE) };
}

/** Six decimals is roughly 10cm, far past what any of this data justifies. */
const round = (value) => Math.round(value * 1e6) / 1e6;

async function fetchOverpass() {
  const query = `[out:json][timeout:180];
(
${SELECTORS.map((selector) => `  ${selector}(${BBOX});`).join("\n")}
);
out center;`;

  for (const endpoint of ENDPOINTS) {
    process.stderr.write(`overpass: ${endpoint}\n`);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "waypoint-fixture-import (github.com/AlexanderBaikal)",
        },
        body: new URLSearchParams({ data: query }),
      });
      if (!response.ok) {
        process.stderr.write(`  HTTP ${response.status}\n`);
        continue;
      }
      return await response.json();
    } catch (error) {
      process.stderr.write(`  ${error.message}\n`);
    }
  }
  throw new Error("every Overpass endpoint failed");
}

// --- run ---------------------------------------------------------------

const args = process.argv.slice(2);
const rawFlag = args.indexOf("--raw");
const dryRun = args.includes("--dry-run");

const response =
  rawFlag === -1
    ? await fetchOverpass()
    : JSON.parse(readFileSync(args[rawFlag + 1], "utf8"));

const existing = JSON.parse(readFileSync(PLACES, "utf8"));
const { curated, rejected } = curate(
  existing.filter((place) => !place.id.startsWith("osm-")),
  { south: SOUTH, west: WEST, north: NORTH, east: EAST },
);

const imported = (response.elements ?? []).map(toPlace).filter(Boolean);

// OSM often holds the same place twice: a node for the entrance and a way for
// the building. Keep the better-described copy of each.
const seen = [];
const deduped = [];
for (const place of imported.sort((a, b) => b.score - a.score)) {
  const key = normaliseName(place.name);
  const twin = seen.find(
    (other) => other.key === key && metres(other.coords, place.coords) < DUPLICATE_METRES,
  );
  if (twin) continue;
  seen.push({ key, coords: place.coords });
  deduped.push(place);
}

// The hand-entered places win over their OSM counterparts: they have photos,
// ratings and reviews attached to their ids.
const withoutCurated = deduped.filter(
  (place) =>
    !curated.some(
      (own) =>
        normaliseName(own.name) === normaliseName(place.name) &&
        metres(own.coords, place.coords) < DUPLICATE_METRES,
    ),
);

const kept = selectPopular(withoutCurated, {
  limit: LIMIT,
  cap: kindCap(LIMIT),
  perName: MAX_BRANCHES,
});

/**
 * Photographs are found by scripts/import-photos.mjs in a second pass, against
 * databases this one does not read. A re-import that dropped them would send
 * anyone re-running this to run that too, so a place that keeps its id keeps
 * its picture.
 */
const photographed = new Map(
  existing.filter((place) => place.cover).map((place) => [place.id, place]),
);
const withPhotos = kept.map((place) => {
  const before = photographed.get(place.id);
  if (!before) return place;
  return { ...place, cover: before.cover, coverCredit: before.coverCredit ?? null };
});

const places = [...curated, ...withPhotos]
  // `kind` and `score` are import bookkeeping, not part of the shape the app
  // reads.
  .map(({ kind: _kind, score: _score, ...place }) => place)
  .sort((a, b) => a.name.localeCompare(b.name, "ru"));

const json = `${JSON.stringify(places)}\n`;

process.stderr.write(
  [
    `elements:   ${response.elements?.length ?? 0}`,
    `usable:     ${imported.length}`,
    `deduped:    ${deduped.length}`,
    `kept:       ${kept.length} (limit ${LIMIT})`,
    `curated:    ${curated.length}${rejected.length ? ` (${rejected.length} rejected)` : ""}`,
    ...rejected.map((line) => `  dropped:  ${line}`),
    `total:      ${places.length}`,
    `with hours: ${places.filter((place) => place.schedule).length}`,
    `with phone: ${places.filter((place) => place.phone).length}`,
    `size:       ${(json.length / 1024).toFixed(0)} kB`,
    "",
  ].join("\n"),
);

if (dryRun) {
  process.stderr.write("dry run: nothing written\n");
} else {
  writeFileSync(PLACES, json);
  process.stderr.write(`written: ${PLACES.pathname}\n`);
}
