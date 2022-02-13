import { expect, test, type Page } from "@playwright/test";
import places from "../src/data/fixtures/places.json" with { type: "json" };
import { revealZooms } from "../src/features/map/prominence";
import type { Place } from "../src/domain/place";

/**
 * Runs against the production build with no .env, so the dataset is the
 * bundled fixtures, the same file this reads, which is why the totals below
 * are counted rather than written down. Twenty of the places are hand-entered
 * and carry reviews. What is worth testing here rather than in jsdom is the
 * part that needs a real browser: Leaflet rendering tiles and markers, the
 * thinning that decides which of them are drawn, and the marker layer staying
 * in step with the list.
 */
const TOTAL = places.length;
const total = new RegExp(`${TOTAL.toLocaleString("en-US")} places`);

/** The place the thinning keeps off the map for longest. */
const HIDDEN_LONGEST = (() => {
  const zooms = revealZooms(places as unknown as Place[]);
  return (places as unknown as Place[]).reduce((deepest, place) =>
    (zooms.get(place.id) ?? 0) > (zooms.get(deepest.id) ?? 0) ? place : deepest,
  );
})();

const markers = (page: Page) => page.locator(".leaflet-marker-icon");
const results = (page: Page) => page.getByRole("listitem");

const search = (page: Page) => page.getByRole("searchbox", { name: /search places/i });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(total)).toBeVisible();
});

test("the panel waits to be asked before it lists anything", async ({ page }) => {
  // Every place is on the map already; the list is what a question produces.
  await expect(results(page)).toHaveCount(0);
  await expect(page.getByText(/search for one, or pick a category/i)).toBeVisible();

  // Retrying, not a single count: the query is deferred on purpose, so the
  // rows arrive a frame or two after the keystroke and a one-shot read races
  // them. Under a loaded machine it loses.
  await search(page).fill("museum");
  await expect(results(page)).not.toHaveCount(0);
});

test("thins the full dataset instead of drawing every pin", async ({ page }) => {
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await expect(markers(page).first()).toBeVisible();

  // The whole city fits on screen at the opening zoom, so what is drawn is
  // what the thinning let through rather than what happens to be in view. The
  // exact number moves with the viewport, so this asserts the magnitude.
  expect(await markers(page).count()).toBeLessThan(TOTAL / 3);
});

test("the panel lists a readable page of a large result set", async ({ page }) => {
  // Addresses are searched along with names, and most of this city is on a
  // "улица", so this matches well past the sixty rows the panel will draw. No
  // category is that large now that the map ships two hundred places.
  await search(page).fill("улица");

  await expect(results(page)).toHaveCount(60);
  await expect(page.getByText(/more on the map/i)).toBeVisible();
});

test("zooming out leaves only the places that outrank their neighbours", async ({
  page,
}) => {
  await expect(markers(page).first()).toBeVisible();
  const atCity = await markers(page).count();

  const zoomOut = page.getByRole("button", { name: "Zoom out" });
  await zoomOut.click();
  await zoomOut.click();
  await expect.poll(() => markers(page).count()).toBeLessThan(atCity);

  // And zooming back in hands the rest their pins back: coming in never takes
  // away something that was already on screen.
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  await zoomIn.click();
  await zoomIn.click();
  await expect.poll(() => markers(page).count()).toBeGreaterThanOrEqual(atCity);
});

test("search narrows the list and the markers together", async ({ page }) => {
  await search(page).fill("trendy quarter");

  await expect(page.getByText("1 place", { exact: true })).toBeVisible();
  await expect(results(page)).toHaveCount(1);
  await expect(markers(page)).toHaveCount(1);
});

test("a small result set is drawn pin by pin, with nothing thinned out", async ({
  page,
}) => {
  await search(page).fill("museum");

  // Settle first, then read: the deferred render means the count is not final
  // the instant the field changes.
  await expect(results(page)).not.toHaveCount(0);
  const count = await results(page).count();
  expect(count).toBeGreaterThan(1);
  await expect(markers(page)).toHaveCount(count);
});

test("a category chip filters to that category", async ({ page }) => {
  const filters = page.getByRole("group", { name: /filter places/i });
  await filters.getByRole("button", { name: /education/i }).click();

  await expect(page.getByText(/^\d+ places$/)).toBeVisible();
  await expect(results(page)).not.toHaveCount(0);
  await expect(page.getByText(/education/i).first()).toBeVisible();
});

test("clicking a marker opens the place and updates the address bar", async ({
  page,
}) => {
  await search(page).fill("yarkomoll");
  await markers(page).first().click();

  await expect(page.getByRole("heading", { name: "Yarkomoll" })).toBeVisible();
  await expect(page).toHaveURL(/place=yarkomoll/);
});

test("a shared link opens straight into the place", async ({ page }) => {
  await page.goto("/?place=kinomoll");

  await expect(page.getByRole("heading", { name: "Kinomoll" })).toBeVisible();
  await expect(page.getByText(/movie theater/i)).toBeVisible();
});

test("an imported place keeps its pin even where the map has thinned it out", async ({
  page,
}) => {
  // Deep-linking to a place that loses its corner to a more prominent
  // neighbour must still leave something selected on the map. The place is the
  // one the thinning holds back longest, read from the same rule the map uses.
  // Writing an id down here would mean re-importing the fixture silently turns
  // this into a test of a place that is drawn anyway.
  await page.goto(`/?place=${encodeURIComponent(HIDDEN_LONGEST.id)}`);

  await expect(page.getByRole("heading", { name: HIDDEN_LONGEST.name })).toBeVisible();
  await expect(page.getByRole("img", { name: HIDDEN_LONGEST.name })).toBeVisible();
});

test("saving a place survives a reload", async ({ page }) => {
  await page.goto("/?place=inrtu");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByRole("button", { name: /saved/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /saved/i })).toBeVisible();
});

test("opening hours are shown for a place that has them", async ({ page }) => {
  await page.goto("/?place=trendy-quarter");

  await page.getByText("Opening hours").click();
  await expect(page.getByRole("row").first()).toContainText("Mon");
});

test("no results offers a way back", async ({ page }) => {
  await search(page).fill("qqqq");
  await expect(page.getByText(/nothing here matches/i)).toBeVisible();

  await page.getByRole("button", { name: /clear filters/i }).click();
  await expect(page.getByText(total)).toBeVisible();
});
