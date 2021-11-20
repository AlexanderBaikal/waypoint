import { CATEGORY_META, categoryOf, presentCategories } from "./categories";
import type { Place } from "./place";
import places from "../data/fixtures/places.json";

const withType = (type: string) => ({ type }) as Place;

describe("categoryOf", () => {
  it("maps known types", () => {
    expect(categoryOf(withType("Shopping mall"))).toBe("shopping");
    expect(categoryOf(withType("Nightclub"))).toBe("nightlife");
    expect(categoryOf(withType("University"))).toBe("education");
  });

  it("ignores case and stray whitespace", () => {
    expect(categoryOf(withType("  fast FOOD "))).toBe("food");
  });

  it("files the long retail tail by suffix", () => {
    expect(categoryOf(withType("Tile shop"))).toBe("shopping");
    expect(categoryOf(withType("Variety store"))).toBe("shopping");
    // The table wins over the suffix where a shop is really a service.
    expect(categoryOf(withType("Barber shop"))).toBe("services");
  });

  it("falls back to other for anything unrecognised", () => {
    expect(categoryOf(withType("Sporting goods store"))).toBe("shopping");
    expect(categoryOf(withType("Yurt repair"))).toBe("other");
    expect(categoryOf(withType(""))).toBe("other");
  });

  /**
   * scripts/import-osm.mjs invents type names from OpenStreetMap tags, and this
   * table has to keep up with it. When it does not, the symptom is a map full
   * of "other" pins with no filter chip behind them — so that is what is
   * measured, rather than the two tables being compared row by row.
   */
  it("recognises all but a fraction of the shipped dataset", () => {
    const unrecognised = (places as Place[]).filter(
      (place) => categoryOf(place) === "other",
    );
    const share = unrecognised.length / places.length;

    expect(share, [...new Set(unrecognised.map((p) => p.type))].join(", ")).toBeLessThan(
      0.02,
    );
  });
});

describe("presentCategories", () => {
  it("lists only categories the data actually contains", () => {
    const places = [withType("Bar"), withType("Bank"), withType("Nightclub")];
    expect(presentCategories(places)).toEqual(["nightlife", "services"]);
  });

  it("returns nothing for an empty dataset", () => {
    expect(presentCategories([])).toEqual([]);
  });
});

describe("CATEGORY_META", () => {
  it("has a label and glyph for every category", () => {
    for (const [category, meta] of Object.entries(CATEGORY_META)) {
      expect(meta.label, category).toBeTruthy();
      expect(meta.glyph, category).toBeTruthy();
    }
  });
});
