import { expect, test, type Page } from "@playwright/test";

/**
 * Runs against the production build with no .env, so the dataset is the
 * bundled fixtures and every run sees the same 20 places. What is worth
 * testing here rather than in jsdom is the part that needs a real browser:
 * Leaflet actually rendering tiles and markers, and the marker layer staying
 * in step with the list.
 */

const markers = (page: Page) => page.locator(".leaflet-marker-icon");
const results = (page: Page) => page.getByRole("listitem");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("20 places")).toBeVisible();
});

test("renders a map with a marker for every place", async ({ page }) => {
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await expect(markers(page)).toHaveCount(20);
  await expect(results(page)).toHaveCount(20);
});

test("search narrows the list and the markers together", async ({ page }) => {
  await page.getByRole("searchbox", { name: /search places/i }).fill("trendy");

  await expect(page.getByText("1 place", { exact: true })).toBeVisible();
  await expect(results(page)).toHaveCount(1);
  await expect(markers(page)).toHaveCount(1);
});

test("a category chip filters to that category", async ({ page }) => {
  const filters = page.getByRole("group", { name: /filter by category/i });
  await filters.getByRole("button", { name: /education/i }).click();

  await expect(results(page)).toHaveCount(2);
  await expect(markers(page)).toHaveCount(2);
});

test("clicking a marker opens the place and updates the address bar", async ({
  page,
}) => {
  await page.getByRole("searchbox", { name: /search places/i }).fill("yarkomoll");
  await markers(page).first().click();

  await expect(page.getByRole("heading", { name: "Yarkomoll" })).toBeVisible();
  await expect(page).toHaveURL(/place=yarkomoll/);
});

test("a shared link opens straight into the place", async ({ page }) => {
  await page.goto("/?place=kinomoll");

  await expect(page.getByRole("heading", { name: "Kinomoll" })).toBeVisible();
  await expect(page.getByText(/movie theater/i)).toBeVisible();
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
  await page.getByRole("searchbox", { name: /search places/i }).fill("qqqq");
  await expect(page.getByText(/nothing here matches/i)).toBeVisible();

  await page.getByRole("button", { name: /clear filters/i }).click();
  await expect(page.getByText("20 places")).toBeVisible();
});
