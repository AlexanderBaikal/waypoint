import { createFixtureRepository } from "./fixtures";
import { foldRating, mayEdit } from "./repository";
import { blankPlace } from "../domain/placeInput";
import type { Place, Review } from "../domain/place";
import bundledPlaces from "./fixtures/places.json";
import bundledReviews from "./fixtures/reviews.json";

const author = { uid: "u1", name: "Alex", photoUrl: null };
const other = { uid: "u2", name: "Someone else", photoUrl: null };
const coords = { lat: 52.28, lng: 104.3 };

const input = (name: string) => ({ ...blankPlace(coords), name, type: "Cafe" });

/**
 * The offline repository is not a stub: it is what the published demo runs
 * on, so its write path is the one most people will exercise.
 */
describe("fixture repository", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds a created place to the list", async () => {
    const repository = createFixtureRepository();
    const before = (await repository.listPlaces()).length;

    const created = await repository.createPlace(input("Test Cafe"), author);

    expect(created.id).toBe("test-cafe");
    expect(created.authorId).toBe("u1");
    expect(created.rating).toBeNull();
    expect(await repository.listPlaces()).toHaveLength(before + 1);
  });

  it("gives two places of the same name different ids", async () => {
    const repository = createFixtureRepository();
    await repository.createPlace(input("Test Cafe"), author);
    const second = await repository.createPlace(input("Test Cafe"), author);
    expect(second.id).toBe("test-cafe-2");
  });

  it("keeps edits across a reload", async () => {
    const first = createFixtureRepository();
    await first.createPlace(input("Kept Cafe"), author);

    // A second repository stands in for the next page load.
    const second = createFixtureRepository();
    const places = await second.listPlaces();
    expect(places.some((place) => place.id === "kept-cafe")).toBe(true);
  });

  it("refuses an edit to someone else's place", async () => {
    const repository = createFixtureRepository();
    const created = await repository.createPlace(input("Mine"), author);

    await expect(
      repository.updatePlace(created.id, input("Theirs"), other),
    ).rejects.toThrow(/permission/i);
  });

  it("lets anyone edit a place with no owner", async () => {
    const repository = createFixtureRepository();
    // Imported places carry no author, which is what makes them community-editable.
    const imported = (await repository.listPlaces()).find(
      (place) => place.authorId === null,
    );
    expect(imported).toBeDefined();

    const updated = await repository.updatePlace(
      imported!.id,
      { ...input("Corrected name"), coords: imported!.coords },
      other,
    );
    expect(updated.name).toBe("Corrected name");
  });

  it("folds a new review into the place's rating", async () => {
    const repository = createFixtureRepository();
    const created = await repository.createPlace(input("Rated"), author);

    await repository.addReview(created.id, { rating: 4, text: "Fine" }, author);
    await repository.addReview(created.id, { rating: 5, text: "Better" }, other);

    const place = (await repository.listPlaces()).find((p) => p.id === created.id);
    expect(place?.rating).toEqual({ value: 4.5, count: 2 });
    expect(await repository.listReviews(created.id)).toHaveLength(2);
  });
});

/**
 * The dataset is half imported and half inherited from the 2021 database, and
 * the inherited half arrived carrying a park in Panama, phone numbers reading
 * "No data yet", opening times of 01:02 to 01:02, and photographs in a Cloud
 * Storage bucket this project no longer pays for. scripts/curate.mjs is what
 * takes those out on the way in; this is what says they stay out, whichever
 * way the file is next edited.
 */
describe("the bundled dataset", () => {
  const places = bundledPlaces as Place[];
  const reviews = bundledReviews as Review[];
  const ids = new Set(places.map((place) => place.id));

  it("is all in one city", () => {
    // The box scripts/import-osm.mjs queries Overpass with. A place outside it
    // is one the import could not have found, and it stretches the map to two
    // continents the moment a filter frames what is left.
    for (const { id, coords } of places) {
      expect(coords.lat, id).toBeGreaterThan(52.2);
      expect(coords.lat, id).toBeLessThan(52.36);
      expect(coords.lng, id).toBeGreaterThan(104.15);
      expect(coords.lng, id).toBeLessThan(104.42);
    }
  });

  it("links to no bucket this project stopped paying for", () => {
    const media = [
      ...places.flatMap((place) => [place.cover, ...place.photos]),
      ...reviews.flatMap((review) => review.photos),
    ].filter(Boolean);

    expect(media.length).toBeGreaterThan(0);
    for (const url of media) expect(url).not.toContain("firebasestorage");
  });

  it("keeps no field the old editor only prompted with", () => {
    const prompts =
      /^(add (name|address|website|phone number)|no (website|phone number|data)( yet)?)$/i;
    for (const place of places) {
      for (const value of [
        place.name,
        place.type,
        place.address,
        place.phone,
        place.about,
      ]) {
        if (value) expect(value, place.id).not.toMatch(prompts);
      }
    }
  });

  it("states no opening time that is not one", () => {
    for (const place of places.filter((entry) => entry.schedule)) {
      for (const day of Object.values(place.schedule!)) {
        if (day.closed || day.allDay) continue;
        expect(day.open, place.id).not.toBe(day.close);
      }
    }
  });

  it("carries no review of a place that is not here, or of no place at all", () => {
    for (const review of reviews) {
      expect(ids.has(review.placeId), review.id).toBe(true);
      // The form cannot post either of these; both arrived in the old data.
      expect(review.rating, review.id).toBeGreaterThanOrEqual(1);
      expect(review.rating, review.id).toBeLessThanOrEqual(5);
      expect(review.text.trim(), review.id).not.toBe("");
    }
  });
});

/**
 * scripts/import-photos.mjs writes these, against two databases that answer
 * differently every month. What is checked here is not which places got a
 * photograph, which moves, but that a re-import cannot land the fixture in a
 * state the panel would render dishonestly or a licence would forbid.
 */
describe("the bundled photographs", () => {
  const places = bundledPlaces as Place[];
  const credited = places.filter((place) => place.coverCredit);

  it("covers half the map", () => {
    // The floor the import is aimed at, set a little under what it currently
    // finds: a half-failed harvest should fail here rather than ship a bare
    // map. Deliberately not higher. Coverage past this point can only come
    // from photographs taken further and further from the place, and that is a
    // worse map rather than a better one.
    expect(
      places.filter((place) => place.cover).length / places.length,
    ).toBeGreaterThanOrEqual(0.45);
  });

  it("credits every photograph it sourced", () => {
    for (const place of credited) {
      expect(place.cover, place.id).toBeTruthy();
      expect(place.coverCredit?.source, place.id).toBeTruthy();
      // The link to the file page is the part no licence lets us drop; author
      // and licence are not always recorded on Commons and may be null.
      expect(place.coverCredit?.sourceUrl, place.id).toMatch(/^https:\/\//);
    }
  });

  it("holds every cover to https, as the rules and the browser do", () => {
    for (const place of places.filter((place) => place.cover)) {
      expect(place.cover, place.id).toMatch(/^https:\/\//);
    }
  });

  it("does not pass off the surroundings as the place", () => {
    const nearby = credited.filter((place) => place.coverCredit?.nearbyMetres !== null);
    // None may claim a distance the import could not have produced, 50 m
    // being its ceiling.
    for (const place of nearby) {
      expect(place.coverCredit?.nearbyMetres, place.id).toBeLessThanOrEqual(50);
    }
  });

  it("labels a stock photograph as not of the place", () => {
    const generic = credited.filter((place) => place.coverCredit?.generic);
    // Places with nothing close enough to be honestly "nearby" carry a stock
    // photograph of their type instead, and it must never claim a distance.
    expect(generic.length).toBeGreaterThan(0);
    for (const place of generic) {
      expect(place.coverCredit?.nearbyMetres, place.id).toBeNull();
    }
  });
});

describe("mayEdit", () => {
  it("needs a session", () => {
    expect(mayEdit({ authorId: null }, null)).toBe(false);
  });

  it("lets an owner through and nobody else", () => {
    expect(mayEdit({ authorId: "u1" }, "u1")).toBe(true);
    expect(mayEdit({ authorId: "u1" }, "u2")).toBe(false);
  });

  it("treats an unowned place as community-maintained", () => {
    expect(mayEdit({ authorId: null }, "u2")).toBe(true);
  });
});

describe("foldRating", () => {
  it("starts an average", () => {
    expect(foldRating(null, 4)).toEqual({ value: 4, count: 1 });
  });

  it("moves an average by one score, rounded to a tenth", () => {
    expect(foldRating({ value: 4, count: 2 }, 5)).toEqual({ value: 4.3, count: 3 });
  });
});
