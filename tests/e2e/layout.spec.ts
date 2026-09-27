import { expect, test } from "@playwright/test";

/**
 * CONSTITUTION P-14: every screen works on every device width without horizontal scrolling,
 * and on desktop/laptop the content spans the full width, margin to margin.
 */
const PAGES = ["/", "/prijava"];
const WIDTHS = [320, 375, 768, 1024, 1366, 1920, 2560];

/** Skips the splash (its own timing is covered in splash-and-language.spec.ts). */
async function waitForApp(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(() => "IDSSSplash" in window);
  await page.evaluate(() => (window as unknown as { IDSSSplash: { dismiss(): void } }).IDSSSplash.dismiss());
  await expect(page.locator("html")).toHaveAttribute("data-splash", "done", { timeout: 10000 });
}

for (const path of PAGES) {
  test(`${path} has no horizontal scroll at any width`, async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await waitForApp(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} at ${width}px`).toBe(0);
    }
  });

  test(`${path} content spans the full width on desktop`, async ({ page }) => {
    for (const width of [1366, 1920, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await waitForApp(page);
      const card = await page.locator("main .card").first().boundingBox();
      expect(card, `${path} card at ${width}px`).not.toBeNull();
      // Only the page margins (at most 72 px per side) may remain empty.
      expect(card!.width, `${path} at ${width}px`).toBeGreaterThanOrEqual(width - 2 * 72 - 1);
    }
  });
}
