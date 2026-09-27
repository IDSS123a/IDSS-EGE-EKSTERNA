import { expect, test, type ConsoleMessage } from "@playwright/test";
import splashMessages from "../../public/splash/messages.json";

/** Collect console errors and uncaught exceptions (hydration mismatches surface here). */
function trackErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("splash is in the first HTML response with the official logo and a pool message", async ({ request }) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(html.indexOf('id="idss-splash"')).toBeGreaterThan(-1);
  expect(html.indexOf('id="idss-splash"')).toBeLessThan(html.indexOf("page__main"));
  expect(html).toContain('src="/brand/idss-logo.png"');
  expect(splashMessages.bs.some((message) => html.includes(message))).toBe(true);
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});

test("splash leaves after the app is ready and the app becomes visible, without console errors", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.locator("#idss-splash")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-splash", "done", { timeout: 10000 });
  await expect(page.locator("#idss-splash")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors.filter((text) => !text.includes("net::ERR_"))).toEqual([]);
});

test("language switches instantly without reload and persists", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-splash", "done", { timeout: 10000 });
  const navigationMarker = await page.evaluate(() => performance.timeOrigin);

  await page.getByText("DE", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Die Plattform ist im Aufbau");

  await page.getByText("EN", { exact: true }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("The platform is under construction");
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(navigationMarker); // no reload

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("[data-splash-message]")).toHaveText(new RegExp(splashMessages.en.map(escape).join("|")));
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("splash renders a static field and still leaves", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-splash", "done", { timeout: 10000 });
  });
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("if no script runs at all, the splash still leaves and the app becomes visible (CSS fail-safe)", async ({ page }) => {
  test.setTimeout(40_000);
  await page.route(/\.js(\?|$)/, (route) => route.abort());
  await page.goto("/prijava");
  await expect(page.locator("#idss-splash")).toBeVisible();
  await expect(page.locator("body > .page")).toBeHidden();
  await expect(page.locator("#idss-splash")).toBeHidden({ timeout: 20_000 });
  await expect(page.locator("body > .page")).toBeVisible();
});
