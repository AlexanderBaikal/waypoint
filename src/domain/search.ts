import { categoryOf, type Category } from "./categories";
import type { Place } from "./place";

export interface PlaceFilter {
  query: string;
  categories: readonly Category[];
}

/**
 * Lowercase, strip accents, collapse whitespace. The dataset mixes Latin and
 * Cyrillic names, so "Дикая" and "dikaya" both need to behave predictably.
 */
export function normaliseForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function haystack(place: Place): string {
  return normaliseForSearch([place.name, place.type, place.address ?? ""].join(" "));
}

/**
 * Ranks a place against a query. Higher is better, 0 means "no match".
 * A name that starts with the query beats one that merely contains it, which
 * keeps "sub" from putting Sberbank above Subway.
 */
export function scorePlace(place: Place, query: string): number {
  const needle = normaliseForSearch(query);
  if (!needle) return 1;

  const name = normaliseForSearch(place.name);
  if (name === needle) return 100;
  if (name.startsWith(needle)) return 80;

  const tokens = needle.split(" ");
  const hay = haystack(place);
  if (!tokens.every((token) => hay.includes(token))) return 0;

  return name.includes(needle) ? 60 : 40;
}

export function filterPlaces(places: readonly Place[], filter: PlaceFilter): Place[] {
  const categories = new Set(filter.categories);

  return places
    .map((place) => ({ place, score: scorePlace(place, filter.query) }))
    .filter(({ place, score }) => {
      if (score === 0) return false;
      return categories.size === 0 || categories.has(categoryOf(place));
    })
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
    .map(({ place }) => place);
}
