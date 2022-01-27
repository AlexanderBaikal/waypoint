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
   * The category's icon, as the `d` of a single path on a 24×24 grid, stroked
   * rather than filled. One string rather than a component so the same drawing
   * can go into React and into the raw HTML string a Leaflet divIcon takes.
   */
  path: string;
  /**
   * The category's colour wherever it appears — filter chip, list row, map
   * pin. This is the only saturated colour in the application, and it is a
   * legend: two things sharing a hue are the same kind of place.
   */
  colour: string;
}

/**
 * Hues follow what a reader already expects from a map — food warm, leisure
 * green, services a neutral slate — with two forced moves. Shopping is teal
 * rather than the blue maps usually give it, because blue is the interface's
 * "you can act on this" and a category must never look clickable. Other is
 * grey on purpose: it is the bucket for a type we failed to classify, and it
 * should not advertise itself next to seven real categories.
 *
 * Every one of these clears 3:1 against white, which is what the white glyph
 * sitting on top of it needs.
 */
export const CATEGORY_META: Record<Category, CategoryMeta> = {
  food: {
    label: "Food",
    glyph: "◆",
    colour: "#e2582a",
    // Fork and knife.
    path: "M7 4v5a2 2 0 0 0 4 0V4M9 11v9M16.5 4c1.6 1.6 1.6 5.4 0 7v9",
  },
  nightlife: {
    label: "Nightlife",
    glyph: "✦",
    colour: "#8b46c4",
    // Cocktail glass.
    path: "M5 5h14l-7 7zM12 12v7M8.5 19h7",
  },
  shopping: {
    label: "Shopping",
    glyph: "▲",
    colour: "#0f8a8a",
    // Shopping bag.
    path: "M5.5 8h13l-1 12h-11zM9 8V6a3 3 0 0 1 6 0v2",
  },
  services: {
    label: "Services",
    glyph: "■",
    colour: "#5b6674",
    // Briefcase: banks, post offices and repair shops have no one shape.
    path: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  },
  leisure: {
    label: "Leisure",
    glyph: "●",
    colour: "#2f9e44",
    // A ticket. Nothing fits this bucket — it holds parks, gyms, museums,
    // cinemas and war memorials — so the mark says "somewhere you go" and
    // leaves the specifics to the type written beside it. A tree was tried
    // first and read as a mistake on everything that was not a park.
    path: "M20 9.5V6H4v3.5a2.5 2.5 0 0 1 0 5V18h16v-3.5a2.5 2.5 0 0 1 0-5z",
  },
  education: {
    label: "Education",
    glyph: "▮",
    colour: "#b8790c",
    // Graduation cap.
    path: "M12 4 2.5 8.5 12 13l9.5-4.5zM6.5 10.7V16c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-5.3",
  },
  lodging: {
    label: "Stay",
    glyph: "▼",
    colour: "#d1477a",
    // Bed: headboard, mattress, a rounded foot, and a pillow on top.
    path: "M3 6v12M3 12h15a3 3 0 0 1 3 3v3M3 18h18M6.5 9.5h4",
  },
  other: {
    label: "Other",
    glyph: "×",
    colour: "#7b8290",
    // Three dots: the bucket for a type we could not name.
    path: "M6.5 12h.01M12 12h.01M17.5 12h.01",
  },
};

// The `type` field is free text — typed by whoever added the place, or derived
// from an OpenStreetMap tag by scripts/import-osm.mjs — so this is a lookup
// with a sensible fallback rather than an exhaustive taxonomy. Keys are
// lowercased on both sides.
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
 * Retail types the map data has a long tail of — "tile shop", "toy shop",
 * "variety store" — all belong in one bucket. A suffix rule covers the tail
 * without a hundred more table rows, and the table still wins where a shop is
 * really a service (a barber shop is not shopping).
 */
const RETAIL_SUFFIX = /\b(shop|store|boutique)$/;

export function categoryOf(place: Pick<Place, "type">): Category {
  const type = place.type.trim().toLowerCase();
  const known = TYPE_TO_CATEGORY[type];
  if (known) return known;
  return RETAIL_SUFFIX.test(type) ? "shopping" : "other";
}

/**
 * Categories actually represented in a dataset, in CATEGORIES order.
 * Filter chips are built from this so we never render a filter that matches
 * nothing.
 */
export function presentCategories(places: readonly Place[]): Category[] {
  const present = new Set(places.map(categoryOf));
  return CATEGORIES.filter((category) => present.has(category));
}
