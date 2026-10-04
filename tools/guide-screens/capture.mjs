/**
 * Takes the user guide screenshots (PDL-031) from the real screens with trial data.
 *   node tools/guide-screens/capture.mjs            all screenshots
 *   node tools/guide-screens/capture.mjs t-plan-mat  only the named ones
 * Copies page.tsx to src/app/zz-guide/[screen]/page.tsx, starts `next dev` on port 3311 (unless GUIDE_BASE is set to a
 * running server with the copy in place), writes public/guide/<image>.webp and removes the copy again.
 * Needs Chromium (PW_CHROMIUM_PATH or the Playwright default).
 */
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import shots from "./shots.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const route = join(root, "src", "app", "zz-guide", "[screen]");
const out = join(root, "public", "guide");
const only = process.argv.slice(2);
const external = process.env.GUIDE_BASE;
const base = external ?? "http://localhost:3311";
const WIDTH = 1280;

let server = null;
if (!external) {
  mkdirSync(route, { recursive: true });
  copyFileSync(join(root, "tools", "guide-screens", "page.tsx"), join(route, "page.tsx"));
  server = spawn("npx", ["next", "dev", "-p", "3311"], { cwd: root, stdio: "ignore", shell: process.platform === "win32" });
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(`${base}/zz-guide/hub`)).ok) break; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
// bypassCSP only lets the capture hide the splash and draw the highlight; the app itself is unchanged.
const context = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, bypassCSP: true, locale: "bs-BA" });
const failures = [];
for (const shot of shots.filter((entry) => only.length === 0 || only.includes(entry.image))) {
  const page = await context.newPage();
  try {
    await page.goto(base + shot.path, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "#idss-splash{display:none!important} html,body,body>*{visibility:visible!important;opacity:1!important} nextjs-portal{display:none!important} *{animation-duration:0s!important;transition-duration:0s!important}" });
    for (const target of [].concat(shot.click ?? [])) await page.locator(target).first().click();
    for (const target of shot.check ?? []) await page.locator(target).check();
    for (const [target, value] of Object.entries(shot.fill ?? {})) await page.locator(target).fill(value);
    await page.waitForTimeout(shot.wait ?? 400);
    const highlight = page.locator(shot.highlight).first();
    await highlight.scrollIntoViewIfNeeded();
    await highlight.evaluate((element) => {
      element.style.outline = "4px solid #ffcb29";
      element.style.outlineOffset = "4px";
      element.style.borderRadius = element.style.borderRadius || "8px";
      element.style.boxShadow = "0 0 0 10px rgba(255, 203, 41, 0.28)";
    });
    // Page coordinates (boundingBox is relative to the viewport, the full-page clip to the page).
    const pageBox = (locator) => locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
    });
    const box = await pageBox(highlight);
    const area = shot.focus ? await pageBox(page.locator(shot.focus).first()) : null;
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const maxHeight = shot.maxHeight ?? 900;
    let top;
    let bottom;
    if (area) {
      // The region from its top, as far as the highest height allows, always with the highlight inside.
      top = Math.max(0, area.y - 16);
      bottom = Math.min(area.y + area.height + 16, top + maxHeight);
      if (box.y + box.height + 40 > bottom) {
        bottom = Math.min(pageHeight, box.y + box.height + 60);
        top = Math.max(0, Math.min(top, bottom - maxHeight));
      }
    } else {
      const height = Math.min(maxHeight, Math.max(520, box.height + 220));
      top = Math.max(0, Math.min(box.y + box.height / 2 - height / 2, pageHeight - height));
      bottom = top + height;
    }
    const clip = { x: 0, y: top, width: WIDTH, height: Math.max(200, bottom - top) };
    const png = await page.screenshot({ clip, fullPage: true });
    await sharp(png).webp({ quality: 78 }).toFile(join(out, `${shot.image}.webp`));
    console.log("ok", shot.image);
  } catch (error) {
    failures.push(shot.image);
    console.log("FAIL", shot.image, String(error).split("\n")[0]);
  } finally {
    await page.close();
  }
}
await browser.close();
if (server) {
  server.kill();
  rmSync(join(root, "src", "app", "zz-guide"), { recursive: true, force: true });
}
if (failures.length > 0) {
  console.log(`${failures.length} failed: ${failures.join(" ")}`);
  process.exitCode = 1;
}
