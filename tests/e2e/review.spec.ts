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
