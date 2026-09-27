import { expect, test } from "@playwright/test";

/**
 * Review area access control (Sprint 04). Signed-in review needs the live database and is
 * verified live with the subject teachers; here every unauthenticated or forged path fails closed.
 */
const VERSION_ID = "4c2d1a9e-7b6f-4e3d-8c2b-abcdefabcdef";

for (const path of ["/app/pregled", "/app/pregled/12", "/app/pregled/pravila?predmet=mathematics"]) {
  test(`${path} is not reachable without a session`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/prijava$/);
  });
}

test("the review source PDF is not served without a session", async ({ request }) => {
  const response = await request.get(`/app/pregled/izvor/${VERSION_ID}`, { maxRedirects: 0 });
  expect(response.status()).not.toBe(200);
  expect(response.headers()["content-type"] ?? "").not.toContain("application/pdf");
});

test("a forged session cookie does not open the review queue or a source", async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: "sb-dezevstfmfliyasdeflj-auth-token", value: "base64-eyJmb3JnZWQiOnRydWV9", url: baseURL ?? "http://localhost:3100" },
  ]);
  await page.goto("/app/pregled");
  await expect(page).toHaveURL(/\/prijava$/);
  const response = await page.request.get(`/app/pregled/izvor/${VERSION_ID}`, { maxRedirects: 0 });
  expect(response.status()).not.toBe(200);
});

test("the CSP allows workers only from the same origin", async ({ request }) => {
  const csp = (await request.get("/prijava")).headers()["content-security-policy"];
  expect(csp).toContain("worker-src 'self'");
});

test("the canon search is not reachable without a session", async ({ page }) => {
  await page.goto("/app/pretraga");
  await expect(page).toHaveURL(/\/prijava$/);
});

test("the settings screen is not reachable without a session", async ({ page }) => {
  await page.goto("/app/postavke");
  await expect(page).toHaveURL(/\/prijava$/);
});

test("the splash palette is public, cacheable and falls back to the default", async ({ request }) => {
  const response = await request.get("/splash/palette");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("max-age=60");
  const body = await response.json();
  expect(Object.keys(body.shares).sort()).toEqual(["blue", "red", "sky", "yellow"]);
  expect(body.weights).toHaveLength(4);
});

test("the footer links the legal documents and the contact on public pages", async ({ page }) => {
  await page.goto("/prijava");
  const footer = page.locator("footer.site-footer");
  // The app, footer included, becomes visible when the splash leaves.
  await expect(footer).toBeVisible({ timeout: 20_000 });
  await expect(footer.getByRole("link")).toHaveCount(5);
  await expect(footer.locator('a[href="mailto:ai@idss.ba"]')).toBeVisible();
  await footer.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/uslovi-koristenja$/);
  await expect(page.locator("main")).toContainText("ai@idss.ba");
  await expect(page.locator("main h2").first()).toBeVisible();
});

test("the privacy policy names the data protection officer and the law", async ({ page }) => {
  await page.goto("/politika-privatnosti");
  const main = page.locator("main");
  await expect(main).toBeVisible({ timeout: 20_000 });
  await expect(main).toContainText("gdpr@idss.ba");
  await expect(main).toContainText("12/25");
  await expect(main.locator("li").first()).toBeVisible();
});

test("the own account page is not reachable without a session", async ({ page }) => {
  await page.goto("/app/nalog");
  await expect(page).toHaveURL(/\/prijava$/);
});
