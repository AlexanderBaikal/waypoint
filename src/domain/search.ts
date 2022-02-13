import { categoryOf, type Category } from "./categories";
import { byName, type Place } from "./place";

export interface PlaceFilter {
  query: string;
  categories: readonly Category[];
}

/** Lowercase, strip accents, collapse whitespace. */
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
 * Normalising is the expensive half of a search (NFD plus two regexes per
 * field) and the query changes on every keystroke, so the result is computed
 * once per place. A WeakMap lets a place dropped from the dataset take its
 * entry with it.
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
 * without this the panel opens on whatever the alphabet puts first, which in
 * this dataset is a run of names beginning with digits. Rated and photographed
 * places lead instead, being the ones with a detail page worth opening.
 *
 * Distinct from `prominence` in features/map: that one drives marker thinning
 * and weighs far more fields. This is only a tie-break.
 */
function detailRank(place: Place): number {
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
        detailRank(b.place) - detailRank(a.place) ||
        // The same comparison the repositories list by, so an unfiltered search
        // and the stored order do not disagree about two equally good places.
        byName(a.place, b.place),
    )
    .map(({ place }) => place);
}
