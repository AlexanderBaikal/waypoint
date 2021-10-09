import { WEEKDAYS, type Coords, type Schedule } from "../domain/place";

/**
 * Readers for the 2021 Firestore schema.
 *
 * Everything here exists because the stored data is messier than its nominal
 * shape: the old editor saved its input placeholders as real values, opening
 * times were free text, and coordinates were written two different ways. These
 * are pure functions so the awkward cases can be pinned down in tests rather
 * than discovered in production.
 */

/** Values the old editor wrote when a field was left untouched. */
const PLACEHOLDERS = new Set([
  "add name",
  "add address",
  "add website",
  "add phone number",
  "no website yet",
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
 * [lat, lng] array. The old client read both with Object.values(), which
 * flattened them by accident; this is explicit about it.
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

    // A day that claims to be open but has no usable times makes the whole
    // schedule untrustworthy, so we show nothing rather than something wrong.
    if (!closed && !allDay && (open === null || close === null)) return null;

    schedule[day] = { open: open ?? "00:00", close: close ?? "00:00", allDay, closed };
  }
  return schedule;
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
