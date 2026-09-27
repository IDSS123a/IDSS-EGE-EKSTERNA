import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the production build (`next start`).
 * PW_CHROMIUM_PATH lets sandboxes with a pre-installed Chromium reuse it instead of downloading.
 */
const E2E_PORT = 3100;
const chromiumPath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next start -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
