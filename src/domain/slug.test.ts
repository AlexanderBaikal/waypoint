import { describe, expect, it } from "vitest";
import { slugFor, uniqueSlug } from "./slug";

describe("slugFor", () => {
  it("makes a readable id out of a Latin name", () => {
    expect(slugFor("Cafe Central")).toBe("cafe-central");
    expect(slugFor("  O'Key  ")).toBe("okey");
  });

  it("transliterates Cyrillic rather than dropping it", () => {
    // Stripping non-Latin characters would leave an empty id for most of this
    // dataset, which is in Russian.
    expect(slugFor("Слата")).toBe("slata");
    expect(slugFor("Кофейня «Чашка»")).toBe("kofeynya-chashka");
  });

  it("strips accents from Latin", () => {
    expect(slugFor("Café Crème")).toBe("cafe-creme");
  });

  it("falls back rather than returning nothing", () => {
    expect(slugFor("!!!")).toBe("place");
    expect(slugFor("")).toBe("place");
  });

  it("keeps ids to a sensible length without a trailing dash", () => {
    const slug = slugFor("word ".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("returns the plain slug when it is free", () => {
    expect(uniqueSlug("Cafe Central", () => false)).toBe("cafe-central");
  });

  it("walks up until it finds a free one", () => {
    const taken = new Set(["cafe-central", "cafe-central-2"]);
    expect(uniqueSlug("Cafe Central", (slug) => taken.has(slug))).toBe("cafe-central-3");
  });

  it("gives up rather than looping forever", () => {
    expect(() => uniqueSlug("Cafe", () => true)).toThrow(/free id/);
  });
});
