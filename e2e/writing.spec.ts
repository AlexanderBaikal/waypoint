import { expect, test, type Page } from "@playwright/test";

/**
 * The write vertical, against the production build with no .env — so the
 * repository behind it is the bundled fixtures, edits land in localStorage, and
 * the run needs no credentials. What is worth a real browser here is the part
 * jsdom cannot host: the location picker is a second Leaflet map, and the
 * cover preview is an actual image load.
 */

const panel = (page: Page) => page.locator("aside");
const field = (page: Page, name: RegExp) => page.getByLabel(name);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/1,620 places/)).toBeVisible();
});

test("adds a place and lands on it", async ({ page }) => {
  await page.getByRole("button", { name: /^\+ Add$/ }).click();

  await expect(page.getByRole("heading", { name: /add a place/i })).toBeVisible();
  await expect(page.getByTestId("location-picker")).toBeVisible();

  await field(page, /^name$/i).fill("Test Coffee");
  await field(page, /^type$/i).fill("Cafe");
  await page.getByRole("button", { name: /add place/i }).click();

  // The panel opens on what was just added.
  await expect(page.getByRole("heading", { name: "Test Coffee" })).toBeVisible();
  await expect(page).toHaveURL(/place=test-coffee/);

  // And it is a real row in the dataset, findable like any other.
  await page.getByRole("button", { name: /all places/i }).click();
  await page.getByRole("searchbox", { name: /search places/i }).fill("Test Coffee");
  await expect(page.getByText("1 place", { exact: true })).toBeVisible();
});

test("an added place survives a reload", async ({ page }) => {
  await page.getByRole("button", { name: /^\+ Add$/ }).click();
  await field(page, /^name$/i).fill("Kept Place");
  await field(page, /^type$/i).fill("Bar");
  await page.getByRole("button", { name: /add place/i }).click();
  await expect(page.getByRole("heading", { name: "Kept Place" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Kept Place" })).toBeVisible();
});

test("says what is missing rather than failing silently", async ({ page }) => {
  await page.getByRole("button", { name: /^\+ Add$/ }).click();
  await page.getByRole("button", { name: /add place/i }).click();

  await expect(page.getByText(/a place needs a name/i)).toBeVisible();
  await expect(page.getByText(/say what kind of place/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /add a place/i })).toBeVisible();
});

test("previews a photo link, and says so when one is broken", async ({ page }) => {
  // Both outcomes are served by the test rather than by the internet, so the
  // run needs no network and cannot go flaky on someone else's uptime.
  const PIXEL = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.route("**/good.png", (route) =>
    route.fulfill({ contentType: "image/png", body: PIXEL }),
  );
  await page.route("**/gone.png", (route) => route.abort());

  await page.getByRole("button", { name: /^\+ Add$/ }).click();

  await field(page, /^photo/i).fill("https://example.test/good.png");
  await expect(page.locator("img[src='https://example.test/good.png']")).toBeVisible();
  await expect(page.getByText(/did not load/i)).toBeHidden();

  await field(page, /^photo/i).fill("https://example.test/gone.png");
  await expect(page.getByText(/did not load/i)).toBeVisible();
});

test("edits a place that has no owner", async ({ page }) => {
  await page.goto("/?place=osm-n2918849719");
  await expect(page.getByRole("heading", { name: /Биг Бен/ })).toBeVisible();

  await page.getByRole("button", { name: /^edit$/i }).click();
  const name = field(page, /^name$/i);
  await name.fill("Big Ben of Irkutsk");
  await page.getByRole("button", { name: /save changes/i }).click();

  await expect(page.getByRole("heading", { name: "Big Ben of Irkutsk" })).toBeVisible();
});

test("adds opening hours through the seven-day editor", async ({ page }) => {
  await page.getByRole("button", { name: /^\+ Add$/ }).click();
  await field(page, /^name$/i).fill("Hours Test");
  await field(page, /^type$/i).fill("Cafe");

  await page.getByRole("button", { name: /add opening hours/i }).click();
  await page.getByLabel(/sun: open, closed or all day/i).selectOption("closed");
  await page.getByLabel(/mon opens at/i).fill("08:00");
  await page.getByLabel(/mon closes at/i).fill("22:00");

  await page.getByRole("button", { name: /add place/i }).click();
  await expect(page.getByRole("heading", { name: "Hours Test" })).toBeVisible();

  await panel(page).getByText("Opening hours").click();
  await expect(page.getByRole("row").first()).toContainText("08:00");
});

test("posts a review and folds it into the rating", async ({ page }) => {
  await page.goto("/?place=kinomoll");
  await expect(page.getByRole("heading", { name: "Kinomoll" })).toBeVisible();

  await page.getByRole("button", { name: /write a review/i }).click();
  await page.getByRole("radio", { name: /5 stars/i }).check();
  await page.getByLabel(/what was it like/i).fill("Comfortable seats and a big screen");
  await page.getByRole("button", { name: /post review/i }).click();

  await expect(page.getByText("Comfortable seats and a big screen")).toBeVisible();
});

test("a review needs both a score and something said", async ({ page }) => {
  await page.goto("/?place=kinomoll");
  await page.getByRole("button", { name: /write a review/i }).click();
  await page.getByRole("button", { name: /post review/i }).click();

  await expect(page.getByText(/pick a rating/i)).toBeVisible();
  await expect(page.getByText(/say something about the place/i)).toBeVisible();
});
