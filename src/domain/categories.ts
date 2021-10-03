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

// The `type` field is free text typed by whoever added the place, so this is a
// lookup with a sensible fallback rather than an exhaustive taxonomy. Keys are
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

  "convenience store": "shopping",
  "clothing shop": "shopping",
  "general store": "shopping",
  market: "shopping",
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
  "gas station": "services",
  hospital: "services",
  "medical/health services": "services",
  pharmacy: "services",
  "post office": "services",

  garden: "leisure",
  gym: "leisure",
  "historical landmark": "leisure",
  "movie theater": "leisure",
  museum: "leisure",
  "park and garden": "leisure",
  playground: "leisure",
  "sports club": "leisure",
  "tourist attraction": "leisure",

  college: "education",
  "driving school": "education",
  "education centre": "education",
  school: "education",
  university: "education",

  "bed & breakfast": "lodging",
  hostel: "lodging",
  hotel: "lodging",
  motel: "lodging",
};

export function categoryOf(place: Pick<Place, "type">): Category {
  return TYPE_TO_CATEGORY[place.type.trim().toLowerCase()] ?? "other";
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
