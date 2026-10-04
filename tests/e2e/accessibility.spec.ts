import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Accessibility, WCAG 2.2 level AA (PDL-041 L3): axe finds no violation on the public pages, in every interface
 * language, on desktop and phone (both Playwright projects), with the splash dismissed.
 */
const PAGES = ["/", "/prijava", "/uslovi-koristenja", "/politika-privatnosti", "/kolacici", "/pretplata"];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function waitForApp(page: Page): Promise<void> {
  await page.waitForFunction(() => "IDSSSplash" in window);
  await page.evaluate(() => (window as unknown as { IDSSSplash: { dismiss(): void } }).IDSSSplash.dismiss());
  await expect(page.locator("html")).toHaveAttribute("data-splash", "done", { timeout: 10000 });
}

for (const path of PAGES) {
  test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(path);
    await waitForApp(page);
    const results = await new AxeBuilder({ page }).withTags(TAGS).exclude("#idss-splash").analyze();
    const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(summary, path).toEqual([]);
  });
}

test("the sign-in page has no violations in German and English", async ({ page }) => {
  await page.goto("/prijava");
  await waitForApp(page);
  for (const lang of ["DE", "EN"]) {
    await page.getByText(lang, { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", lang.toLowerCase());
    // Measure colours after the switcher's transition, not halfway through it.
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
    const results = await new AxeBuilder({ page }).withTags(TAGS).exclude("#idss-splash").analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`), lang).toEqual([]);
  }
});
