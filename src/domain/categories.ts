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
  /** Single glyph drawn inside the map pin. */
  glyph: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  food: { label: "Food", glyph: "◆" },
  nightlife: { label: "Nightlife", glyph: "✦" },
  shopping: { label: "Shopping", glyph: "▲" },
  services: { label: "Services", glyph: "■" },
  leisure: { label: "Leisure", glyph: "●" },
  education: { label: "Education", glyph: "▮" },
  lodging: { label: "Stay", glyph: "▼" },
  other: { label: "Other", glyph: "×" },
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
