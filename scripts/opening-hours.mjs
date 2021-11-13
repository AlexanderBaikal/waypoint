/**
 * A deliberately partial reader for OpenStreetMap `opening_hours`.
 *
 * The full grammar covers seasons, school holidays, sunset offsets and week
 * numbers. Waypoint's Schedule can express exactly one span per weekday, so
 * anything richer than that cannot be represented honestly and is rejected
 * rather than approximated — a place whose hours we cannot state is better off
 * showing nothing than showing something plausible and wrong.
 *
 * Kept out of src/ on purpose: this runs at import time, so none of it belongs
 * in the bundle the browser downloads.
 */

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_INDEX = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };

/** Day-like tokens that carry no weekday meaning for us. */
const IGNORED_DAYS = new Set(["ph", "sh"]);

/** Constructs we cannot represent; their presence rejects the whole value. */
const UNSUPPORTED =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|week|easter|sunrise|sunset|dusk|dawn)\b|\[|"/i;

const CLOSED = { open: "00:00", close: "00:00", allDay: false, closed: true };
const ALL_DAY = { open: "00:00", close: "00:00", allDay: true, closed: false };

/** "9:00", "09:00" and "24:00" all land on a padded 24h string. */
function time(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24) return null;
  // 24:00 is midnight at the far end of the day; the domain model spells that
  // as 00:00 and infers the wrap from close <= open.
  return `${String(hours % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "Mo-Fr", "Sa", "Mo-Th,Su" → the weekday indices they cover. */
function readDays(spec) {
  if (!spec) return [0, 1, 2, 3, 4, 5, 6];

  const indices = new Set();
  for (const token of spec.split(",")) {
    const part = token.trim().toLowerCase();
    if (!part || IGNORED_DAYS.has(part)) continue;

    const range = /^([a-z]{2})-([a-z]{2})$/.exec(part);
    if (range) {
      const from = DAY_INDEX[range[1]];
      const to = DAY_INDEX[range[2]];
      if (from === undefined || to === undefined) return null;
      // Ranges wrap: "Fr-Mo" is Friday through Monday.
      for (let i = from; ; i = (i + 1) % 7) {
        indices.add(i);
        if (i === to) break;
      }
      continue;
    }

    const single = DAY_INDEX[part];
    if (single === undefined) return null;
    indices.add(single);
  }

  return [...indices];
}

/**
 * The hours half of a rule. Multiple spans in a day ("08:00-13:00,14:00-20:00")
 * collapse to the outer envelope, which is the closest the model can get.
 */
function readHours(spec) {
  const value = spec.trim().toLowerCase();
  if (!value || value === "off" || value === "closed") return CLOSED;
  if (value === "24/7" || value === "00:00-24:00") return ALL_DAY;

  const spans = value.split(",").map((span) => span.trim());
  const first = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(spans[0]);
  const last = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(spans[spans.length - 1]);
  if (!first || !last) return null;

  const open = time(first[1]);
  const close = time(last[2]);
  if (open === null || close === null) return null;

  return { open, close, allDay: false, closed: false };
}

/**
 * A comma separates two rules when it follows a completed one — a time or an
 * `off` — and starts a new day name. Inside a day list ("Mo-Th,Su") it follows
 * a day, and inside a time list ("08:00-13:00,14:00-20:00") it precedes a
 * digit, so neither is split here.
 */
const RULE_SEPARATOR = /(?<=\d{2}:\d{2}|\boff|\bclosed)\s*,\s*(?=[A-Za-z])/;

const splitRules = (value) =>
  value
    .split(";")
    .flatMap((part) => part.split(RULE_SEPARATOR))
    .map((rule) => rule.trim())
    .filter(Boolean);

/**
 * Returns a Schedule, or null when the value is absent, unsupported, or
 * malformed. Days no rule mentions are closed, which is how OSM reads a rule
 * set with no explicit fallback.
 */
export function parseOpeningHours(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || UNSUPPORTED.test(trimmed)) return null;

  if (trimmed === "24/7") {
    return Object.fromEntries(DAYS.map((day) => [day, { ...ALL_DAY }]));
  }

  const byIndex = new Array(7).fill(null);

  for (const rule of splitRules(trimmed)) {
    const match = /^([A-Za-z]{2}(?:\s*[-,]\s*[A-Za-z]{2})*)?\s*(.*)$/.exec(rule);
    if (!match) return null;

    const days = readDays(match[1]?.trim() ?? "");
    const hours = readHours(match[2] ?? "");
    if (days === null || hours === null) return null;

    // Public-holiday-only rules ("PH off") carry no weekday to apply to.
    if (days.length === 0) continue;

    // A later rule wins for the days it names, as in the OSM specification.
    for (const index of days) byIndex[index] = hours;
  }

  if (byIndex.every((entry) => entry === null)) return null;

  return Object.fromEntries(
    DAYS.map((day, index) => [day, byIndex[index] ?? { ...CLOSED }]),
  );
}
