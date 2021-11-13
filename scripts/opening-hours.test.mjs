import { parseOpeningHours } from "./opening-hours.mjs";

const open = (from, to) => ({ open: from, close: to, allDay: false, closed: false });
const CLOSED = { open: "00:00", close: "00:00", allDay: false, closed: true };
const ALL_DAY = { open: "00:00", close: "00:00", allDay: true, closed: false };

describe("parseOpeningHours", () => {
  it("expands 24/7 across the week", () => {
    const schedule = parseOpeningHours("24/7");
    expect(Object.values(schedule)).toEqual(Array(7).fill(ALL_DAY));
  });

  it("applies a bare time range to every day", () => {
    const schedule = parseOpeningHours("08:00-21:00");
    expect(schedule.monday).toEqual(open("08:00", "21:00"));
    expect(schedule.sunday).toEqual(open("08:00", "21:00"));
  });

  it("reads a weekday range", () => {
    const schedule = parseOpeningHours("Mo-Fr 09:00-18:00");
    expect(schedule.friday).toEqual(open("09:00", "18:00"));
    // Days no rule mentions are closed rather than inherited.
    expect(schedule.saturday).toEqual(CLOSED);
  });

  it("reads several semicolon-separated rules", () => {
    const schedule = parseOpeningHours(
      "Mo-Fr 08:00-13:00,14:00-20:00; Sa 09:00-13:00; Su off",
    );
    // A split day collapses to its envelope, the closest the model can express.
    expect(schedule.monday).toEqual(open("08:00", "20:00"));
    expect(schedule.saturday).toEqual(open("09:00", "13:00"));
    expect(schedule.sunday).toEqual(CLOSED);
  });

  it("treats a comma after a time as a rule separator", () => {
    const schedule = parseOpeningHours("Mo-Fr 12:00-00:00, Sa-Su 14:00-00:00");
    expect(schedule.monday).toEqual(open("12:00", "00:00"));
    expect(schedule.saturday).toEqual(open("14:00", "00:00"));
  });

  it("treats a comma after a day as part of the day list", () => {
    const schedule = parseOpeningHours("Mo-Th,Su 08:00-22:00");
    expect(schedule.monday).toEqual(open("08:00", "22:00"));
    expect(schedule.sunday).toEqual(open("08:00", "22:00"));
    expect(schedule.friday).toEqual(CLOSED);
  });

  it("ignores public-holiday tokens in a day list", () => {
    const schedule = parseOpeningHours("Mo-Su,PH 07:00-02:00");
    expect(schedule.wednesday).toEqual(open("07:00", "02:00"));
  });

  it("wraps a day range that crosses the weekend", () => {
    const schedule = parseOpeningHours("Fr-Mo 10:00-16:00");
    expect(schedule.friday).toEqual(open("10:00", "16:00"));
    expect(schedule.monday).toEqual(open("10:00", "16:00"));
    expect(schedule.wednesday).toEqual(CLOSED);
  });

  it("normalises 24:00 and unpadded hours", () => {
    expect(parseOpeningHours("9:00-24:00").monday).toEqual(open("09:00", "00:00"));
  });

  it("lets a later rule override an earlier one", () => {
    const schedule = parseOpeningHours("Mo-Su 10:00-20:00; Su 12:00-18:00");
    expect(schedule.saturday).toEqual(open("10:00", "20:00"));
    expect(schedule.sunday).toEqual(open("12:00", "18:00"));
  });

  it("rejects what it cannot represent", () => {
    expect(parseOpeningHours("Mo-Fr sunrise-sunset")).toBeNull();
    expect(parseOpeningHours("Jan-Mar 10:00-18:00")).toBeNull();
    expect(parseOpeningHours('Mo-Fr 09:00-18:00 "ring the bell"')).toBeNull();
    expect(parseOpeningHours("Mo-Fr 09:00-18:00; week 1-53 off")).toBeNull();
    expect(parseOpeningHours("nonsense")).toBeNull();
    expect(parseOpeningHours("")).toBeNull();
    expect(parseOpeningHours(undefined)).toBeNull();
  });

  it("rejects a rule set that closes every day", () => {
    // "off" everywhere carries no information the UI can use.
    expect(parseOpeningHours("PH off")).toBeNull();
  });
});
