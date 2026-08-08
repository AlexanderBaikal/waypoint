import { describe, expect, it } from "vitest";
import {
  blankPlace,
  blankSchedule,
  isValid,
  optional,
  validatePlace,
  validateReview,
} from "./placeInput";

const coords = { lat: 52.278, lng: 104.295 };
const filled = () => ({
  ...blankPlace(coords),
  name: "Cafe Central",
  type: "Cafe",
});

describe("validatePlace", () => {
  it("accepts the minimum a place needs", () => {
    expect(isValid(validatePlace(filled()))).toBe(true);
  });

  it("requires a name and a type", () => {
    const errors = validatePlace(blankPlace(coords));
    expect(errors.name).toBeDefined();
    expect(errors.type).toBeDefined();
  });

  it("treats whitespace as empty", () => {
    expect(validatePlace({ ...filled(), name: "   " }).name).toBeDefined();
  });

  it("rejects coordinates off the map", () => {
    expect(
      validatePlace({ ...filled(), coords: { lat: 91, lng: 0 } }).coords,
    ).toBeDefined();
    expect(
      validatePlace({ ...filled(), coords: { lat: Number.NaN, lng: 0 } }).coords,
    ).toBeDefined();
  });

  it("enforces the same lengths the rules do", () => {
    expect(validatePlace({ ...filled(), name: "x".repeat(81) }).name).toBeDefined();
    expect(validatePlace({ ...filled(), about: "x".repeat(601) }).about).toBeDefined();
    expect(validatePlace({ ...filled(), name: "x".repeat(80) }).name).toBeUndefined();
  });

  it("accepts a bare hostname as a website but not a sentence", () => {
    expect(
      validatePlace({ ...filled(), website: "example.com" }).website,
    ).toBeUndefined();
    expect(
      validatePlace({ ...filled(), website: "https://example.com/x" }).website,
    ).toBeUndefined();
    expect(validatePlace({ ...filled(), website: "no website" }).website).toBeDefined();
  });

  it("refuses a scheme that is not the web", () => {
    // These end up in an href and an img src. A pattern that looks like it
    // matches hostnames will happily match a hostname-shaped tail after
    // `javascript:`, which is why the check parses the URL instead.
    for (const hostile of [
      "javascript://example.com/%0aalert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "file://example.com/etc/passwd",
    ]) {
      expect(validatePlace({ ...filled(), website: hostile }).website).toBeDefined();
      expect(validatePlace({ ...filled(), cover: hostile }).cover).toBeDefined();
    }
  });

  it("takes a cover as an https link and nothing else", () => {
    expect(
      validatePlace({ ...filled(), cover: "https://example.com/photo.jpg" }).cover,
    ).toBeUndefined();
    // A page served over https cannot show an http image, so accepting one
    // would only produce a silent placeholder.
    expect(
      validatePlace({ ...filled(), cover: "http://example.com/photo.jpg" }).cover,
    ).toBeDefined();
    expect(validatePlace({ ...filled(), cover: "photo.jpg" }).cover).toBeDefined();
    expect(validatePlace({ ...filled(), cover: null }).cover).toBeUndefined();
  });

  it("rejects a day that is open but has no hours", () => {
    const schedule = blankSchedule();
    schedule.monday = { open: "", close: "", allDay: false, closed: false };
    expect(validatePlace({ ...filled(), schedule }).schedule).toBeDefined();
  });

  it("allows a day with no hours when it is closed or open all day", () => {
    const schedule = blankSchedule();
    schedule.monday = { open: "", close: "", allDay: false, closed: true };
    schedule.tuesday = { open: "", close: "", allDay: true, closed: false };
    expect(validatePlace({ ...filled(), schedule }).schedule).toBeUndefined();
  });
});

describe("validateReview", () => {
  it("accepts a rating with something said", () => {
    expect(isValid(validateReview({ rating: 4, text: "Good coffee" }))).toBe(true);
  });

  it("holds the rating to whole stars from one to five", () => {
    expect(validateReview({ rating: 0, text: "x" }).rating).toBeDefined();
    expect(validateReview({ rating: 6, text: "x" }).rating).toBeDefined();
    expect(validateReview({ rating: 3.5, text: "x" }).rating).toBeDefined();
  });

  it("wants some text", () => {
    expect(validateReview({ rating: 4, text: "  " }).text).toBeDefined();
    expect(validateReview({ rating: 4, text: "x".repeat(1001) }).text).toBeDefined();
  });
});

describe("optional", () => {
  it("turns an untouched field into an absent one", () => {
    expect(optional("  ")).toBeNull();
    expect(optional(" kept ")).toBe("kept");
  });
});
