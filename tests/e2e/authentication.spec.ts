import { expect, test } from "@playwright/test";

/**
 * Authentication flows that must hold without a reachable database (CI / sandbox has no
 * Supabase secrets): no fail-open path, uniform errors, localised messages.
 */
test.beforeEach(async ({ page }) => {
  await page.goto("/prijava");
  await expect(page.locator("html")).toHaveAttribute("data-splash", "done", { timeout: 6000 });
});

test("signed-out visitor is redirected from /app to /prijava", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/prijava$/);
});

test("a forged Supabase session cookie does not open /app", async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: "sb-dezevstfmfliyasdeflj-auth-token", value: "base64-eyJmb3JnZWQiOnRydWV9", url: baseURL ?? "http://localhost:3100" },
  ]);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/prijava$/);
});

test("invalid input shows the localised validation message", async ({ page }) => {
  await page.getByLabel("Korisničko ime").fill("ab");
  await page.getByLabel("Lozinka").fill("x");
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await expect(page.locator("#login-error")).toHaveText("Unesite ispravno korisničko ime i lozinku.");
});

test("login without a reachable auth backend fails closed with a friendly message", async ({ page }) => {
  await page.getByLabel("Korisničko ime").fill("direktor@idss.ba");
  await page.getByLabel("Lozinka").fill("not-the-real-password");
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await expect(page.locator("#login-error")).toHaveText("Prijava trenutno nije dostupna. Pokušajte ponovo kasnije.");
  await expect(page).toHaveURL(/\/prijava$/);
  await expect(page.getByLabel("Korisničko ime")).toHaveValue("direktor@idss.ba");
  await expect(page.getByLabel("Lozinka")).toHaveValue("");

  // The same error code follows the live language switch.
  await page.getByText("DE", { exact: true }).click();
  await expect(page.locator("#login-error")).toHaveText("Die Anmeldung ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Anmeldung");
});

test("account administration is not reachable without a session", async ({ page }) => {
  await page.goto("/app/nalozi");
  await expect(page).toHaveURL(/\/prijava$/);
});
