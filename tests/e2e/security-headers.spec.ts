import { expect, test } from "@playwright/test";

/** Content-Security-Policy with a per-request nonce (mandate §7A.7). */
test("every page response carries a nonce-based CSP that changes per request", async ({ request }) => {
  const first = await request.get("/prijava");
  const second = await request.get("/prijava");
  const csp = first.headers()["content-security-policy"];
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("unsafe-inline");
  const nonceOf = (value: string | undefined): string | undefined => value?.match(/'nonce-([^']+)'/)?.[1];
  expect(nonceOf(csp)).toBeTruthy();
  expect(nonceOf(csp)).not.toBe(nonceOf(second.headers()["content-security-policy"]));
  // The nonce in the header is the one on the splash script in the HTML.
  expect(await first.text()).toContain(`nonce="${nonceOf(csp)}"`);
});

test("pages render with zero CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  for (const path of ["/", "/prijava"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-splash", "done", { timeout: 10000 });
  }
  expect(violations).toEqual([]);
});

test("an injected inline script without the nonce is blocked", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  // Simulate a stored-XSS payload in the HTML while keeping the real CSP header.
  await page.route("**/prijava", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace("</body>", "<script>window.__attack = true</script></body>");
    await route.fulfill({ response, body: html });
  });
  await page.goto("/prijava");
  await expect(page.locator("html")).toHaveAttribute("data-splash", "done", { timeout: 10000 });
  expect(await page.evaluate(() => (window as unknown as { __attack?: boolean }).__attack === true)).toBe(false);
  expect(violations.length).toBeGreaterThan(0);
});
