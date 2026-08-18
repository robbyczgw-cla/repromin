import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const slides = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await mkdir(join(dir, "frames"), { recursive: true });

for (const s of slides) {
  await page.goto(`file://${join(dir, "slides.html")}?s=${s}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const out = join(dir, "frames", `${s}.png`);
  await page.screenshot({ path: out, type: "png" });
  process.stdout.write(`wrote ${out}\n`);
}

await browser.close();
