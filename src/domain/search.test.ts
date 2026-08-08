import { describe, expect, it } from "vitest";
import type { Place } from "./place";
import { filterPlaces, normaliseForSearch, scorePlace } from "./search";

function place(name: string, type: string, address: string | null = null): Place {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    type,
    coords: { lat: 52.28, lng: 104.29 },
    address,
    phone: null,
    website: null,
    about: null,
    cover: null,
    coverCredit: null,
    photos: [],
    rating: null,
    schedule: null,
    authorId: null,
  };
}

const subway = place("Subway", "Fast food");
const sberbank = place("Sberbank", "Bank", "Ulitsa Lenina 1");
const park = place("Parque Omar", "Park and Garden");
const club = place("Dikaya Loshad", "Nightclub");

const all = [subway, sberbank, park, club];

describe("normaliseForSearch", () => {
  it("folds case, accents and repeated whitespace", () => {
    expect(normaliseForSearch("  Café   Déjà Vu ")).toBe("cafe deja vu");
  });
});

describe("scorePlace", () => {
  it("matches everything on an empty query", () => {
    expect(scorePlace(subway, "")).toBeGreaterThan(0);
    expect(scorePlace(subway, "   ")).toBeGreaterThan(0);
  });

  it("ranks a name prefix above an incidental substring", () => {
    // "sub" appears at the start of Subway and nowhere in Sberbank's name.
    expect(scorePlace(subway, "sub")).toBeGreaterThan(scorePlace(sberbank, "sub"));
  });

  it("ranks an exact name highest", () => {
    expect(scorePlace(subway, "subway")).toBeGreaterThan(scorePlace(subway, "sub"));
  });

  it("matches on type and address, not only name", () => {
    expect(scorePlace(subway, "fast food")).toBeGreaterThan(0);
    expect(scorePlace(sberbank, "lenina")).toBeGreaterThan(0);
  });

  it("requires every token to appear somewhere", () => {
    expect(scorePlace(sberbank, "bank lenina")).toBeGreaterThan(0);
    expect(scorePlace(sberbank, "bank pizza")).toBe(0);
  });
});

describe("filterPlaces", () => {
  it("returns everything when nothing is filtered", () => {
    expect(filterPlaces(all, { query: "", categories: [] })).toHaveLength(4);
  });

  it("orders results by score, then alphabetically", () => {
    // Sberbank and Subway both start with "s"; Dikaya Loshad only contains one,
    // so it sorts below both of them.
    const results = filterPlaces(all, { query: "s", categories: [] });
    expect(results.map((entry) => entry.name)).toEqual([
      "Sberbank",
      "Subway",
      "Dikaya Loshad",
    ]);
  });

  it("narrows to the selected categories", () => {
    const results = filterPlaces(all, { query: "", categories: ["nightlife"] });
    expect(results).toEqual([club]);
  });

  it("combines query and category", () => {
    expect(filterPlaces(all, { query: "park", categories: ["leisure"] })).toEqual([park]);
    expect(filterPlaces(all, { query: "park", categories: ["food"] })).toEqual([]);
  });

  it("returns nothing rather than everything when the query matches nothing", () => {
    expect(filterPlaces(all, { query: "zzz", categories: [] })).toEqual([]);
  });
});
