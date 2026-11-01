// Content_Queue.Slides_or_Script → JPEG slides (Instagram accepts JPEG only).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./config.js";

const TEMPLATE = path.join(ROOT, "templates", "carousel.html");
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, "templates", "brand.json"), "utf8"));

// "Slide 1: Title | Subtitle"       → { n: 1, fields: ["Title", "Subtitle"] }
// "Slide 3 (cta): Follow | for more" → variant forced to "cta"
// Lines that don't start with "Slide N" continue the previous slide.
export function parseSlides(script = "") {
  const slides = [];
  for (const raw of String(script).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^slide\s*(\d+)\s*(?:\((cover|item|cta)\))?\s*[:.\-–]\s*(.*)$/i);
    if (m) {
      slides.push({ n: Number(m[1]), forced: m[2]?.toLowerCase(), text: m[3] });
    } else if (slides.length) {
      slides[slides.length - 1].text += ` | ${line}`;
    }
  }
  if (slides.length === 0 && script.trim()) slides.push({ n: 1, text: script.trim() });

  return slides.map((s, i) => ({
    variant: s.forced || (i === 0 ? "cover" : i === slides.length - 1 && slides.length >= 3 ? "cta" : "item"),
    fields: s.text.split("|").map((f) => f.trim()).filter(Boolean),
  }));
}

// Reel scripts: "HOOK: ...", "POINT: ...", "CTA: ..." lines → card slides.
export function parseReelScript(script = "") {
  const cards = [];
  for (const raw of String(script).split(/\r?\n/)) {
    const m = raw.trim().match(/^(hook|point|cta)\s*\d*\s*[:\-–]\s*(.+)$/i);
    if (!m) continue;
    const kind = m[1].toLowerCase();
    cards.push({
      kind,
      variant: kind === "hook" ? "cover" : kind === "cta" ? "cta" : "item",
      fields: m[2].split("|").map((f) => f.trim()).filter(Boolean),
    });
  }
  return cards;
}

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    const { chromium } = await import("playwright");
    browserPromise = chromium.launch();
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) await (await browserPromise).close();
  browserPromise = null;
}

// format: "post" (1080x1350) or "story"/"reel" (1080x1920)
export async function renderSlides(slides, outDir, { format = "post", prefix = "slide" } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const height = format === "post" ? 1350 : 1920;
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1080, height }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: "networkidle" }).catch(() =>
    page.goto(pathToFileURL(TEMPLATE).href)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const files = [];
  for (let i = 0; i < slides.length; i++) {
    await page.evaluate(
      (data) => window.renderSlide(data),
      { ...slides[i], index: i + 1, total: slides.length, brand, format, today: today.getTime() }
    );
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(outDir, `${prefix}-${String(i + 1).padStart(2, "0")}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 90, clip: { x: 0, y: 0, width: 1080, height } });
    files.push(file);
  }
  await page.close();
  return files;
}
