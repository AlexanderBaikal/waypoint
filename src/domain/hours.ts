import { WEEKDAYS, type Schedule } from "./place";

const DAY = 24 * 60;
const WEEK = 7 * DAY;

export type OpenState =
  | { status: "open"; until: string | null }
  | { status: "closed"; next: string | null }
  | { status: "unknown" };

/** "HH:MM" or "H:MM" to minutes past midnight. Anything else is not a time. */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatMinutes(minutes: number): string {
  const normalised = ((minutes % DAY) + DAY) % DAY;
  const hours = Math.floor(normalised / 60);
  return `${String(hours).padStart(2, "0")}:${String(normalised % 60).padStart(2, "0")}`;
}

/** Monday-based index, because that is the order schedules are stored in. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

type Interval = [start: number, end: number];

/**
 * Opening hours as intervals in "minutes since Monday 00:00". A day whose
 * closing time is at or before its opening time is treated as running past
 * midnight, so a bar open 20:00–02:00 produces one interval crossing into the
 * next day rather than an empty one.
 */
function toIntervals(schedule: Schedule): Interval[] {
  const intervals: Interval[] = [];

  WEEKDAYS.forEach((day, index) => {
    const hours = schedule[day];
    if (hours.closed) return;

    const base = index * DAY;
    if (hours.allDay) {
      intervals.push([base, base + DAY]);
      return;
    }

    const open = parseTime(hours.open);
    const close = parseTime(hours.close);
    if (open === null || close === null) return;

    intervals.push([base + open, base + (close > open ? close : DAY + close)]);
  });

  return intervals.sort((a, b) => a[0] - b[0]);
}

/** Joins intervals that touch, so a 24/7 week collapses into one span. */
function merge(intervals: Interval[]): Interval[] {
  const merged: Interval[] = [];
  for (const [start, end] of intervals) {
    const last = merged.at(-1);
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

export function openStateAt(schedule: Schedule | null, now: Date): OpenState {
  if (!schedule) return { status: "unknown" };

  const intervals = merge(toIntervals(schedule));
  if (intervals.length === 0) return { status: "closed", next: null };

  const minute = weekdayIndex(now) * DAY + now.getHours() * 60 + now.getMinutes();

  // An interval that started late on Sunday can still be running on Monday
  // morning, so each one is also considered shifted back by a week.
  for (const [start, end] of intervals) {
    for (const offset of [0, -WEEK]) {
      if (minute >= start + offset && minute < end + offset) {
        return { status: "open", until: end - start >= WEEK ? null : formatMinutes(end) };
      }
    }
  }

  const upcoming =
    intervals.find(([start]) => start > minute)?.[0] ?? (intervals[0]?.[0] ?? 0) + WEEK;
  return { status: "closed", next: formatMinutes(upcoming) };
}
