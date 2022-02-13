import { WEEKDAYS, type Coords, type PhotoCredit, type Schedule } from "../domain/place";

/**
 * Readers for the 2021 Firestore schema, where the stored data is messier than
 * its nominal shape: the old editor saved its input placeholders as real
 * values, opening times were free text, and coordinates were written two
 * different ways. Pure functions, so the awkward cases are pinned by tests.
 */

/**
 * Values the old editor wrote when a field was left untouched. The list grew
 * as the inherited rows turned them up; scripts/curate.mjs holds the same set
 * for the bundled fixture, which came out of the same database.
 */
const PLACEHOLDERS = new Set([
  "add name",
  "add address",
  "add website",
  "add phone number",
  "no website yet",
  "no phone number yet",
  "no data yet",
]);

export function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || PLACEHOLDERS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

export function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Most rows hold a Firestore GeoPoint, but a couple were written as a plain
 * [lat, lng] array. The old client read both with Object.values(), flattening
 * them by accident; this handles the two shapes explicitly.
 */
export function readCoords(value: unknown): Coords | null {
  if (typeof value !== "object" || value === null) return null;

  const [lat, lng] = Array.isArray(value)
    ? [readNumber(value[0]), readNumber(value[1])]
    : [
        readNumber((value as { latitude?: unknown }).latitude),
        readNumber((value as { longitude?: unknown }).longitude),
      ];

  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Accepts "9:00" and the typo "9;00" alike; anything else is dropped. */
export function readTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2})\D(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function readSchedule(value: unknown): Schedule | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const schedule = {} as Schedule;
  for (const day of WEEKDAYS) {
    const entry = raw[day];
    if (typeof entry !== "object" || entry === null) return null;
    const hours = entry as Record<string, unknown>;

    const closed = hours.closed === true;
    const allDay = hours.allDay === true;
    const open = readTime(hours.open);
    const close = readTime(hours.close);

    // A day that claims to be open but carries no usable times makes the whole
    // schedule untrustworthy, so show nothing rather than something wrong.
    if (!closed && !allDay && (open === null || close === null)) return null;

    schedule[day] = { open: open ?? "00:00", close: close ?? "00:00", allDay, closed };
  }
  return schedule;
}

/**
 * A cover photograph's provenance. Only the seed script writes this, so the
 * shape is ours, but it is read defensively rather than cast: a half-written
 * credit would print "undefined" under a photograph. A malformed credit becomes
 * no credit, so the photograph appears bare rather than mis-attributed.
 */
export function readPhotoCredit(value: unknown): PhotoCredit | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const source = readString(raw.source);
  if (!source) return null;

  const metres = readNumber(raw.nearbyMetres);
  const generic = raw.generic === true;
  return {
    source,
    sourceUrl: readString(raw.sourceUrl),
    author: readString(raw.author),
    licence: readString(raw.licence),
    nearbyMetres: !generic && metres !== null && metres >= 0 ? Math.round(metres) : null,
    generic,
  };
}

export function readDate(value: unknown): string | null {
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const timestamp = value as { toDate: () => Date };
    return timestamp.toDate().toISOString();
  }
  return typeof value === "string" ? value : null;
}

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
