import { expect, test } from "@playwright/test";

/**
 * Canon registry access control (Sprint 02). Signed-in flows need the live database and are
 * verified by the Director locally; here every unauthenticated or forged path must fail closed.
 */
const VERSION_ID = "4c2d1a9e-7b6f-4e3d-8c2b-abcdefabcdef";

test("the canon registry is not reachable without a session", async ({ page }) => {
  await page.goto("/app/kanon");
  await expect(page).toHaveURL(/\/prijava$/);
});

test("a source download is not reachable without a session", async ({ request }) => {
  const response = await request.get(`/app/kanon/preuzmi/${VERSION_ID}`, { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(response.status());
  expect(response.headers()["location"]).toMatch(/\/prijava$/);
});

test("a forged session cookie does not open the registry or a download", async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: "sb-dezevstfmfliyasdeflj-auth-token", value: "base64-eyJmb3JnZWQiOnRydWV9", url: baseURL ?? "http://localhost:3100" },
  ]);
  await page.goto("/app/kanon");
  await expect(page).toHaveURL(/\/prijava$/);
  const response = await page.request.get(`/app/kanon/preuzmi/${VERSION_ID}`, { maxRedirects: 0 });
  expect(response.status()).not.toBe(200);
  expect(response.headers()["location"] ?? "").not.toContain("supabase");
});

test("the CSP allows direct uploads only to the canon bucket's signed upload path", async ({ request }) => {
  const csp = (await request.get("/prijava")).headers()["content-security-policy"];
  const connect = csp.split(";").map((directive) => directive.trim()).find((directive) => directive.startsWith("connect-src")) ?? "";
  const sources = connect.split(/\s+/).slice(1);
  for (const source of sources.filter((value) => value !== "'self'")) {
    expect(source).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/upload\/sign\/canon-documents\/$/);
  }
});
