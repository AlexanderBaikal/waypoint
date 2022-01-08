/**
 * Ids for newly created places.
 *
 * Ids are user-visible — they are what `?place=` carries — so a new place gets
 * a readable one rather than a random string. Most of this dataset is in
 * Russian, and stripping non-Latin characters would leave nothing at all, so
 * Cyrillic is transliterated rather than dropped.
 *
 * Deliberately separate from `slugify` in src/data/normalise.ts: that one
 * derives ids from the inherited database, and changing what it produces would
 * change the id of every place already linked to.
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
    // Cyrillic first, and only then the accent strip. NFD decomposes й into
    // и plus a combining breve, so stripping marks beforehand would quietly
    // turn "Кофейня" into "kofeinya".
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
 * The first free id in the `slug`, `slug-2`, `slug-3` … series. Callers supply
 * the test for "already taken" because only they know where to look.
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
