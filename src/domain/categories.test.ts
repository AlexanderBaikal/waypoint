import { CATEGORY_META, categoryOf, presentCategories } from "./categories";
import type { Place } from "./place";

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

  it("falls back to other for anything unrecognised", () => {
    expect(categoryOf(withType("Sporting goods store"))).toBe("shopping");
    expect(categoryOf(withType("Yurt repair"))).toBe("other");
    expect(categoryOf(withType(""))).toBe("other");
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
