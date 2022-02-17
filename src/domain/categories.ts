import type { Place } from "./place";

export const CATEGORIES = [
  "food",
  "nightlife",
  "shopping",
  "services",
  "leisure",
  "education",
  "lodging",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

interface CategoryMeta {
  label: string;
  /** Single glyph drawn inside the map pin, where an icon would not survive. */
  glyph: string;
  /**
   * The category's icon, as the `d` of a single stroked path on a 24×24 grid.
   * Drawn by components/CategoryGlyph, which is what decides the stroke; a
   * table of drawings has no business holding markup.
   */
  path: string;
  /**
   * The category's colour wherever it appears: filter chip, list row, map pin.
   * The only saturated colour in the app, and it acts as a legend: two things
   * sharing a hue are the same kind of place.
   */
  colour: string;
}

/**
 * Google's place-icon colours, as the Places API returns them in
 * `iconBackgroundColor`. Eight buckets here, eight colours there, so no ninth
 * had to be invented.
 *
 * Two are reused for a purpose Google does not have: education takes the
 * transport blue and lodging the emergency pink, since this map splits both out
 * of the generic bucket. `other` keeps the generic blue-grey.
 *
 * The white mark on these reads at about 2:1 rather than 3:1. It is a drawing
 * rather than text, and every pin and tile carrying one has the place's name
 * and type beside it.
 */
export const CATEGORY_META: Record<Category, CategoryMeta> = {
  food: {
    label: "Food",
    glyph: "◆",
    colour: "#ff9e67",
    // Fork and knife.
    path: "M7 4v5a2 2 0 0 0 4 0V4M9 11v9M16.5 4c1.6 1.6 1.6 5.4 0 7v9",
  },
  nightlife: {
    label: "Nightlife",
    glyph: "✦",
    colour: "#13b5c7",
    // Cocktail glass.
    path: "M5 5h14l-7 7zM12 12v7M8.5 19h7",
  },
  shopping: {
    label: "Shopping",
    glyph: "▲",
    colour: "#4b96f3",
    // Shopping bag.
    path: "M5.5 8h13l-1 12h-11zM9 8V6a3 3 0 0 1 6 0v2",
  },
  services: {
    label: "Services",
    glyph: "■",
    colour: "#909ce1",
    // Briefcase: banks, post offices and repair shops have no one shape.
    path: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  },
  leisure: {
    label: "Leisure",
    glyph: "●",
    colour: "#4db546",
    // A ticket. The bucket holds parks, gyms, museums, cinemas and memorials,
    // so the mark says "somewhere you go" and leaves the specifics to the type
    // written beside it. A tree read as a mistake on everything but parks.
    path: "M20 9.5V6H4v3.5a2.5 2.5 0 0 1 0 5V18h16v-3.5a2.5 2.5 0 0 1 0-5z",
  },
  education: {
    label: "Education",
    glyph: "▮",
    colour: "#10bdff",
    // Graduation cap.
    path: "M12 4 2.5 8.5 12 13l9.5-4.5zM6.5 10.7V16c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-5.3",
  },
  lodging: {
    label: "Stay",
    glyph: "▼",
    colour: "#f88181",
    // Bed: headboard, mattress, a rounded foot, and a pillow on top.
    path: "M3 6v12M3 12h15a3 3 0 0 1 3 3v3M3 18h18M6.5 9.5h4",
  },
  other: {
    label: "Other",
    glyph: "×",
    colour: "#7b9eb0",
    // Three dots: the bucket for a type we could not name.
    path: "M6.5 12h.01M12 12h.01M17.5 12h.01",
  },
};

// The `type` field is free text, typed by whoever added the place or derived
// from an OpenStreetMap tag by scripts/import-osm.mjs, so this is a lookup with
// a fallback rather than an exhaustive taxonomy. Keys are lowercased on both
// sides.
const TYPE_TO_CATEGORY: Record<string, Category> = {
  bakery: "food",
  cafe: "food",
  "coffee shop": "food",
  "fast food": "food",
  "ice cream shop": "food",
  restaurant: "food",
  "soup kitchen": "food",

  bar: "nightlife",
  nightclub: "nightlife",
  pub: "nightlife",

  "car dealership": "shopping",
  "convenience store": "shopping",
  "clothing shop": "shopping",
  florist: "shopping",
  "garden centre": "shopping",
  "general store": "shopping",
  greengrocer: "shopping",
  haberdashery: "shopping",
  market: "shopping",
  "off-licence": "shopping",
  optician: "shopping",
  perfumery: "shopping",
  "shopping centre": "shopping",
  "shopping mall": "shopping",
  "sporting goods store": "shopping",
  supermarket: "shopping",

  atm: "services",
  bank: "services",
  "barber shop": "services",
  "beauty salon": "services",
  "car park": "services",
  "car wash": "services",
  cashpoint: "services",
  clinic: "services",
  "coworking space": "services",
  dentist: "services",
  "doctor's office": "services",
  drugstore: "services",
  "dry cleaner": "services",
  "equipment rental": "services",
  "estate agency": "services",
  "funeral home": "services",
  "gas station": "services",
  hospital: "services",
  "it company": "services",
  "loan office": "services",
  "massage salon": "services",
  "medical/health services": "services",
  "pet grooming salon": "services",
  pharmacy: "services",
  "post office": "services",
  "rental service": "services",
  tailor: "services",
  "tattoo studio": "services",
  "ticket office": "services",
  "travel agency": "services",
  "veterinary clinic": "services",

  "art gallery": "leisure",
  garden: "leisure",
  gym: "leisure",
  "historical landmark": "leisure",
  memorial: "leisure",
  monument: "leisure",
  "movie theater": "leisure",
  museum: "leisure",
  park: "leisure",
  "park and garden": "leisure",
  // Filed with the museums and memorials rather than given a category of their
  // own: there are four such places in the dataset, and one filter chip for
  // four rows is a filter nobody needs.
  "place of worship": "leisure",
  planetarium: "leisure",
  playground: "leisure",
  "public artwork": "leisure",
  "sports club": "leisure",
  stadium: "leisure",
  "swimming pool": "leisure",
  theatre: "leisure",
  "tourist attraction": "leisure",

  college: "education",
  "driving school": "education",
  "education centre": "education",
  library: "education",
  school: "education",
  university: "education",

  "bed & breakfast": "lodging",
  hostel: "lodging",
  hotel: "lodging",
  motel: "lodging",
};

/**
 * The map data has a long tail of retail types ("tile shop", "toy shop",
 * "variety store") that all belong in one bucket. A suffix rule covers it
 * without a hundred more table rows. The table above still wins, which is how
 * a barber shop stays a service.
 */
const RETAIL_SUFFIX = /\b(shop|store|boutique)$/;

export function categoryOf(place: Pick<Place, "type">): Category {
  const type = place.type.trim().toLowerCase();
  const known = TYPE_TO_CATEGORY[type];
  if (known) return known;
  return RETAIL_SUFFIX.test(type) ? "shopping" : "other";
}

/**
 * Categories actually represented in a dataset, in CATEGORIES order. Filter
 * chips are built from this so no chip matches nothing.
 */
export function presentCategories(places: readonly Place[]): Category[] {
  const present = new Set(places.map(categoryOf));
  return CATEGORIES.filter((category) => present.has(category));
}
