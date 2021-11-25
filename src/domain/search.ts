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

interface Searchable {
  name: string;
  haystack: string;
}

/**
 * Normalising is the expensive half of a search — NFD plus two regexes per
 * field — and the dataset runs to a few thousand places while the query
 * changes on every keystroke. The result depends only on the place, so it is
 * computed once and held against the object itself. A WeakMap means a place
 * dropped from the dataset takes its entry with it.
 */
const searchableCache = new WeakMap<Place, Searchable>();

function searchable(place: Place): Searchable {
  const cached = searchableCache.get(place);
  if (cached) return cached;

  const entry: Searchable = {
    name: normaliseForSearch(place.name),
    haystack: normaliseForSearch([place.name, place.type, place.address ?? ""].join(" ")),
  };
  searchableCache.set(place, entry);
  return entry;
}

/** Scores against an already-normalised query. */
function score(place: Place, needle: string, tokens: readonly string[]): number {
  if (!needle) return 1;

  const { name, haystack } = searchable(place);
  if (name === needle) return 100;
  if (name.startsWith(needle)) return 80;

  if (!tokens.every((token) => haystack.includes(token))) return 0;

  return name.includes(needle) ? 60 : 40;
}

/**
 * Ranks a place against a query. Higher is better, 0 means "no match".
 * A name that starts with the query beats one that merely contains it, which
 * keeps "sub" from putting Sberbank above Subway.
 */
export function scorePlace(place: Place, query: string): number {
  const needle = normaliseForSearch(query);
  return score(place, needle, needle.split(" "));
}

/**
 * Separates places that score the same. With no query every place scores 1, so
 * without this the panel opens on whatever the alphabet puts first — which, in
 * a dataset of sixteen hundred imported places, is a row of names beginning
 * with digits. Rated and photographed places lead instead: they are the ones
 * with a detail page worth opening.
 */
function prominence(place: Place): number {
  return (place.rating ? 4 : 0) + (place.cover ? 2 : 0) + (place.about ? 1 : 0);
}

export function filterPlaces(places: readonly Place[], filter: PlaceFilter): Place[] {
  const categories = new Set(filter.categories);
  // Normalised once for the whole pass rather than once per place.
  const needle = normaliseForSearch(filter.query);
  const tokens = needle.split(" ");

  return places
    .map((place) => ({ place, score: score(place, needle, tokens) }))
    .filter(({ place, score }) => {
      if (score === 0) return false;
      return categories.size === 0 || categories.has(categoryOf(place));
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        prominence(b.place) - prominence(a.place) ||
        a.place.name.localeCompare(b.place.name),
    )
    .map(({ place }) => place);
}
