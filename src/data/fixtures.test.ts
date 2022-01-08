import { createFixtureRepository } from "./fixtures";
import { foldRating, mayEdit } from "./repository";
import { blankPlace } from "../domain/placeInput";

const author = { uid: "u1", name: "Alex", photoUrl: null };
const other = { uid: "u2", name: "Someone else", photoUrl: null };
const coords = { lat: 52.28, lng: 104.3 };

const input = (name: string) => ({ ...blankPlace(coords), name, type: "Cafe" });

/**
 * The offline repository is not a stub — it is what the published demo runs
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
