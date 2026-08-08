import { describe, expect, it } from "vitest";
import { detail, popularity, selectPopular } from "./popularity.mjs";

const CENTRE = { lat: 52.28, lng: 104.285 };

/** A place as import-osm.mjs builds it, with nothing filled in. */
const place = (over = {}) => ({
  id: "osm-n1",
  name: "Somewhere",
  kind: "shop=convenience",
  coords: CENTRE,
  address: null,
  phone: null,
  website: null,
  about: null,
  schedule: null,
  ...over,
});

/** Two kilometres north, which is still a normal part of town. */
const outOfTown = { lat: CENTRE.lat + 0.2, lng: CENTRE.lng };

describe("detail", () => {
  it("counts how completely the record is filled in", () => {
    expect(detail(place())).toBe(0);
    expect(detail(place({ phone: "+7", address: "Ulitsa 1" }))).toBe(2);
    // Opening hours are worth two: they are the field a place has when
    // somebody is actually maintaining it.
    expect(detail(place({ schedule: [] }))).toBe(2);
  });
});

describe("popularity", () => {
  it("puts a place with an encyclopaedia article above one without", () => {
    const article = popularity(place(), { wikipedia: "ru:Дом Волконских" }, CENTRE);
    expect(article).toBeGreaterThan(popularity(place(), {}, CENTRE));
    // And a Wikidata item, the same claim one step weaker, below that.
    expect(article).toBeGreaterThan(popularity(place(), { wikidata: "Q1" }, CENTRE));
  });

  it("ranks a museum over a convenience store of the same description", () => {
    expect(popularity(place({ kind: "tourism=museum" }), {}, CENTRE)).toBeGreaterThan(
      popularity(place(), {}, CENTRE),
    );
  });

  it("prefers the more central of two identical places", () => {
    expect(popularity(place(), {}, CENTRE)).toBeGreaterThan(
      popularity(place({ coords: outOfTown }), {}, CENTRE),
    );
  });

  it("stops rewarding centrality once a place is well out of town", () => {
    const far = { lat: CENTRE.lat + 0.5, lng: CENTRE.lng };
    const farther = { lat: CENTRE.lat + 0.9, lng: CENTRE.lng };
    expect(popularity(place({ coords: far }), {}, CENTRE)).toBe(
      popularity(place({ coords: farther }), {}, CENTRE),
    );
  });

  it("cannot be outweighed by a well-filled-in corner shop", () => {
    const shop = place({
      schedule: [],
      phone: "+7",
      website: "https://shop.example",
      address: "Ulitsa 1",
      about: "Open late",
    });
    // The old rule ranked on exactly this, and the map it produced was a list
    // of whoever had typed the most into OpenStreetMap.
    expect(
      popularity(place({ kind: "tourism=museum" }), { wikipedia: "ru:X" }, CENTRE),
    ).toBeGreaterThan(popularity(shop, {}, CENTRE));
  });

  it("works with no centre to measure from", () => {
    expect(popularity(place({ kind: "tourism=museum" }), {})).toBeGreaterThan(0);
  });
});

describe("selectPopular", () => {
  const scored = (id, kind, score) => ({ id, name: id, kind, score });

  it("takes the highest scores first", () => {
    const kept = selectPopular(
      [scored("a", "amenity=cafe", 1), scored("b", "amenity=bar", 9)],
      { limit: 1 },
    );
    expect(kept.map((p) => p.id)).toEqual(["b"]);
  });

  it("lets no one kind take more than the cap", () => {
    const kept = selectPopular(
      [
        scored("cafe-1", "amenity=cafe", 9),
        scored("cafe-2", "amenity=cafe", 8),
        scored("cafe-3", "amenity=cafe", 7),
        scored("bank", "amenity=bank", 1),
      ],
      { limit: 4, cap: 2 },
    );
    // The third café is dropped for a bank scoring eight points lower, which
    // is the whole point: a map of one kind of place is not a map.
    expect(kept.map((p) => p.id)).toEqual(["cafe-1", "cafe-2", "bank"]);
  });

  it("lets a chain have only so many branches", () => {
    const kept = selectPopular(
      [
        scored("Coffee Like", "amenity=cafe", 9),
        scored("coffee like ", "amenity=cafe", 8),
        scored("Coffee Like", "amenity=cafe", 7),
        scored("Мясо и Хлеб", "amenity=cafe", 1),
      ],
      { limit: 4, perName: 2 },
    );
    expect(kept).toHaveLength(3);
    expect(kept.at(-1)?.name).toBe("Мясо и Хлеб");
  });

  it("keeps everything when there is room for everything", () => {
    const all = [scored("a", "amenity=cafe", 1), scored("b", "amenity=bar", 2)];
    expect(selectPopular(all, { limit: 10 })).toHaveLength(2);
  });

  it("breaks ties by name, so two runs write the same fixture", () => {
    const kept = selectPopular(
      [scored("b", "amenity=cafe", 5), scored("a", "amenity=bar", 5)],
      { limit: 2 },
    );
    expect(kept.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("does not disturb what it was given", () => {
    const all = [scored("a", "amenity=cafe", 1), scored("b", "amenity=bar", 2)];
    selectPopular(all, { limit: 1 });
    expect(all.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
