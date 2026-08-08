import { describe, expect, it } from "vitest";
import type { Place } from "../../domain/place";
import { prominence, revealZooms } from "./prominence";

function place(id: string, lat: number, lng: number, extra: Partial<Place> = {}): Place {
  return {
    id,
    name: id,
    type: "Cafe",
    coords: { lat, lng },
    address: null,
    phone: null,
    website: null,
    about: null,
    cover: null,
    coverCredit: null,
    photos: [],
    rating: null,
    schedule: null,
    authorId: null,
    ...extra,
  };
}

/** Metres, near the latitude the dataset sits at. */
const east = (metres: number) => metres / (111_320 * Math.cos(52.28 * (Math.PI / 180)));

describe("prominence", () => {
  it("puts a rated place above one that is merely filled in", () => {
    const rated = place("rated", 0, 0, { rating: { value: 4.2, count: 30 } });
    const detailed = place("detailed", 0, 0, {
      cover: "cover.jpg",
      about: "A description",
      website: "https://example.com",
      phone: "+7",
      address: "Ulitsa Lenina 1",
    });

    expect(prominence(rated)).toBeGreaterThan(prominence(detailed));
  });

  it("ranks by how much a record has to say", () => {
    const bare = place("bare", 0, 0);
    const some = place("some", 0, 0, { phone: "+7" });
    const more = place("more", 0, 0, { phone: "+7", cover: "cover.jpg" });

    expect(prominence(bare)).toBe(0);
    expect(prominence(some)).toBeGreaterThan(prominence(bare));
    expect(prominence(more)).toBeGreaterThan(prominence(some));
  });

  it("stops counting photographs before a gallery outweighs a rating", () => {
    const gallery = place("gallery", 0, 0, { photos: ["a", "b", "c", "d", "e", "f"] });
    const rated = place("rated", 0, 0, { rating: { value: 1, count: 1 } });

    expect(prominence(gallery)).toBeLessThan(prominence(rated));
  });
});

describe("revealZooms", () => {
  it("draws the most prominent of a crowd first", () => {
    const winner = place("winner", 52.28, 104.29, { rating: { value: 5, count: 10 } });
    const loser = place("loser", 52.28, 104.29 + east(20));

    const zooms = revealZooms([loser, winner]);

    expect(zooms.get("winner")).toBe(0);
    expect(zooms.get("loser")).toBeGreaterThan(zooms.get("winner") ?? 0);
  });

  it("shows places that are nowhere near each other straight away", () => {
    const zooms = revealZooms([
      place("irkutsk", 52.28, 104.29),
      place("lisbon", 38.72, -9.14),
    ]);

    expect(zooms.get("irkutsk")).toBe(0);
    expect(zooms.get("lisbon")).toBe(0);
  });

  it("holds a neighbour back until there is room for it", () => {
    // 300 m apart: roughly 52 px at zoom 14 near this latitude, so the second
    // pin has to wait for about that zoom and must be drawn by the time the
    // map is showing a street.
    const zooms = revealZooms([
      place("a", 52.28, 104.29, { rating: { value: 5, count: 1 } }),
      place("b", 52.28, 104.29 + east(300)),
    ]);

    expect(zooms.get("b")).toBeGreaterThan(11);
    expect(zooms.get("b")).toBeLessThanOrEqual(15);
  });

  it("never leaves two drawn pins on top of each other", () => {
    const places = Array.from({ length: 200 }, (_, index) =>
      place(`p${String(index)}`, 52.27 + (index % 20) * 0.0004, 104.28 + index * 0.0003),
    );
    const zooms = revealZooms(places);

    // Everything drawn at zoom 14 must be at least the spacing apart, which is
    // the whole promise of the thing.
    const drawn = places.filter((p) => (zooms.get(p.id) ?? 0) <= 14);
    const pixels = 256 * 2 ** 14;

    for (const a of drawn) {
      for (const b of drawn) {
        if (a === b) continue;
        const dx = ((a.coords.lng - b.coords.lng) / 360) * pixels;
        const sine = (lat: number) => Math.sin(lat * (Math.PI / 180));
        const merc = (lat: number) => Math.log((1 + sine(lat)) / (1 - sine(lat)));
        const dy = ((merc(b.coords.lat) - merc(a.coords.lat)) / (4 * Math.PI)) * pixels;
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(52);
      }
    }
  });

  it("only ever adds pins as the map zooms in", () => {
    const places = Array.from({ length: 120 }, (_, index) =>
      place(`p${String(index)}`, 52.27 + index * 0.0002, 104.28 + (index % 7) * 0.0005),
    );
    const zooms = revealZooms(places);

    const shown = (zoom: number) =>
      places.filter((p) => (zooms.get(p.id) ?? 0) <= zoom).length;

    for (let zoom = 1; zoom <= 19; zoom += 1) {
      expect(shown(zoom)).toBeGreaterThanOrEqual(shown(zoom - 1));
    }
    expect(shown(19)).toBe(places.length);
  });

  it("does not depend on the order it is given the places", () => {
    const places = Array.from({ length: 60 }, (_, index) =>
      place(`p${String(index)}`, 52.27 + index * 0.0003, 104.28 + (index % 5) * 0.0004),
    );

    const forwards = revealZooms(places);
    const backwards = revealZooms([...places].reverse());

    for (const { id } of places) expect(backwards.get(id)).toBe(forwards.get(id));
  });
});
