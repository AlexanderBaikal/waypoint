/**
 * Ids for newly created places. Ids are user-visible, being what `?place=`
 * carries, so a new place gets a readable one rather than a random string.
 * Cyrillic is transliterated rather than stripped, since most of this dataset
 * is Russian and stripping would leave nothing.
 *
 * Kept separate from `slugify` in data/normalise.ts, which derives ids from the
 * inherited database: changing what that one produces would change the id of
 * every place already linked to.
 */

const CYRILLIC: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const MAX_LENGTH = 60;

export function slugFor(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    // Cyrillic first, then the accent strip. NFD decomposes й into и plus a
    // combining breve, so stripping marks first turns "Кофейня" into
    // "kofeinya".
    .replace(/[а-яё]/g, (character) => CYRILLIC[character] ?? "")
    // Decompose so accented Latin loses its marks rather than its letters.
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-$/, "");

  // A name of nothing but symbols still needs an id.
  return slug || "place";
}

/**
 * The first free id in the `slug`, `slug-2`, `slug-3` … series. The caller
 * supplies the "already taken" test, since only it knows where to look.
 */
export function uniqueSlug(name: string, taken: (slug: string) => boolean): string {
  const base = slugFor(name);
  if (!taken(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${String(suffix)}`;
    if (!taken(candidate)) return candidate;
  }

  throw new Error(`Could not find a free id for "${name}"`);
}
