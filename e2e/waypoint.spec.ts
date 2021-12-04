import { expect, test, type Page } from "@playwright/test";

/**
 * Runs against the production build with no .env, so the dataset is the
 * bundled fixtures: 1,620 places, of which 20 are the hand-entered ones that
 * carry photos and reviews. What is worth testing here rather than in jsdom is
 * the part that needs a real browser — Leaflet rendering tiles, clusters and
 * markers, and the marker layer staying in step with the list.
 */

const markers = (page: Page) => page.locator(".leaflet-marker-icon");
const clusters = (page: Page) => page.getByRole("img", { name: /^Cluster of/ });
const results = (page: Page) => page.getByRole("listitem");

const search = (page: Page) => page.getByRole("searchbox", { name: /search places/i });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/1,620 places/)).toBeVisible();
});

test("clusters the full dataset instead of drawing every pin", async ({ page }) => {
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await expect(clusters(page).first()).toBeVisible();

  // The point of clustering: the DOM holds a marker per visible symbol, not
  // one per place in the dataset. The exact number moves with the viewport, so
  // what is asserted is the order of magnitude.
  expect(await markers(page).count()).toBeLessThan(1620 / 8);
});

test("the panel lists a readable page of a large result set", async ({ page }) => {
  await expect(results(page)).toHaveCount(60);
  await expect(page.getByText(/more on the map/i)).toBeVisible();
});

test("clicking a cluster opens it up", async ({ page }) => {
  const before = await clusters(page).count();
  await clusters(page).first().click();

  // Zooming in splits that cluster, so the map ends up showing more symbols.
  await expect
    .poll(async () => (await clusters(page).count()) + (await markers(page).count()))
    .toBeGreaterThan(before);
});

test("search narrows the list and the markers together", async ({ page }) => {
  await search(page).fill("trendy quarter");

  await expect(page.getByText("1 place", { exact: true })).toBeVisible();
  await expect(results(page)).toHaveCount(1);
  await expect(markers(page)).toHaveCount(1);
});

test("a small result set is drawn pin by pin, with no clusters", async ({ page }) => {
  await search(page).fill("museum");

  const count = await results(page).count();
  expect(count).toBeGreaterThan(1);
  await expect(clusters(page)).toHaveCount(0);
  await expect(markers(page)).toHaveCount(count);
});

test("a category chip filters to that category", async ({ page }) => {
  const filters = page.getByRole("group", { name: /filter by category/i });
  await filters.getByRole("button", { name: /education/i }).click();

  await expect(page.getByText(/^\d+ places$/)).toBeVisible();
  const count = await results(page).count();
  expect(count).toBeGreaterThan(0);
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

test("an imported place keeps its pin even inside a cluster", async ({ page }) => {
  // Deep-linking to a place the cluster would have swallowed must still leave
  // something selected on the map.
  await page.goto("/?place=osm-n2918849719");

  await expect(page.getByRole("heading", { name: /Биг Бен/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Биг Бен/ })).toBeVisible();
});

test("saving a place survives a reload", async ({ page }) => {
  await page.goto("/?place=inrtu");
  await page.getByRole("button", { name: /^✧ Save$/ }).click();
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
  await expect(page.getByText(/1,620 places/)).toBeVisible();
});
