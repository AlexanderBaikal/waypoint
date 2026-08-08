import { describe, expect, it } from "vitest";
import { openStateAt, parseTime, weekdayIndex } from "./hours";
import { WEEKDAYS, type DayHours, type Schedule } from "./place";

const closed: DayHours = { open: "00:00", close: "00:00", allDay: false, closed: true };

function schedule(overrides: Partial<Record<keyof Schedule, DayHours>> = {}): Schedule {
  const base = {} as Schedule;
  for (const day of WEEKDAYS) {
    base[day] = { open: "09:00", close: "18:00", allDay: false, closed: false };
  }
  return { ...base, ...overrides };
}

/** 2024-01-08 is a Monday, which keeps the fixtures easy to reason about. */
const monday = (time: string) => new Date(`2024-01-08T${time}:00`);
const sunday = (time: string) => new Date(`2024-01-07T${time}:00`);

describe("parseTime", () => {
  it("accepts one and two digit hours", () => {
    expect(parseTime("9:05")).toBe(545);
    expect(parseTime("09:05")).toBe(545);
  });

  it("rejects anything that is not a time of day", () => {
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("10;00")).toBeNull();
    expect(parseTime("")).toBeNull();
  });
});

describe("weekdayIndex", () => {
  it("counts from Monday, not Sunday", () => {
    expect(weekdayIndex(monday("12:00"))).toBe(0);
    expect(weekdayIndex(sunday("12:00"))).toBe(6);
  });
});

describe("openStateAt", () => {
  it("reports unknown when there is no schedule", () => {
    expect(openStateAt(null, monday("12:00"))).toEqual({ status: "unknown" });
  });

  it("is open inside the interval and reports the closing time", () => {
    expect(openStateAt(schedule(), monday("12:00"))).toEqual({
      status: "open",
      until: "18:00",
    });
  });

  it("is closed before opening and points at today's opening time", () => {
    expect(openStateAt(schedule(), monday("07:30"))).toEqual({
      status: "closed",
      next: "09:00",
    });
  });

  it("treats the boundary as closed at the closing minute", () => {
    expect(openStateAt(schedule(), monday("18:00")).status).toBe("closed");
    expect(openStateAt(schedule(), monday("17:59")).status).toBe("open");
  });

  it("handles a closing time past midnight", () => {
    const bar = schedule({
      monday: { open: "20:00", close: "02:00", allDay: false, closed: false },
    });

    expect(openStateAt(bar, monday("23:30"))).toEqual({ status: "open", until: "02:00" });
  });

  it("stays open after midnight for the previous day's interval", () => {
    const bar = schedule({
      sunday: { open: "20:00", close: "02:00", allDay: false, closed: false },
    });

    // 01:00 on Monday still belongs to Sunday evening.
    expect(openStateAt(bar, monday("01:00")).status).toBe("open");
  });

  it("skips a closed day when looking for the next opening", () => {
    const withClosedMonday = schedule({ monday: closed });

    expect(openStateAt(withClosedMonday, monday("12:00"))).toEqual({
      status: "closed",
      next: "09:00",
    });
  });

  it("reports an always-open place without a closing time", () => {
    const allDay = schedule(
      Object.fromEntries(
        WEEKDAYS.map((day) => [
          day,
          { open: "00:00", close: "00:00", allDay: true, closed: false },
        ]),
      ),
    );

    expect(openStateAt(allDay, monday("03:00"))).toEqual({ status: "open", until: null });
  });

  it("reports closed with no next opening when every day is closed", () => {
    const never = schedule(Object.fromEntries(WEEKDAYS.map((day) => [day, closed])));

    expect(openStateAt(never, monday("12:00"))).toEqual({ status: "closed", next: null });
  });

  it("wraps to the start of the week when nothing is left after now", () => {
    const mondayOnly = schedule(
      Object.fromEntries(
        WEEKDAYS.filter((day) => day !== "monday").map((day) => [day, closed]),
      ),
    );

    expect(openStateAt(mondayOnly, sunday("12:00"))).toEqual({
      status: "closed",
      next: "09:00",
    });
  });
});
