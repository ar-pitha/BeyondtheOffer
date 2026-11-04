// Content_Queue.Slides_or_Script → JPEG slides (Instagram accepts JPEG only).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./config.js";

const TEMPLATE = path.join(ROOT, "templates", "carousel.html");
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, "templates", "brand.json"), "utf8"));

// Things the Instagram API can't add (stickers) or that are notes for a designer
const NOT_A_SLIDE = /\b(sticker|visuals?|music|audio|voiceover|b-roll)\b/i;
const LOOKS_LIKE_CTA = /\b(follow|comment|link in bio|save this|share this|tag a friend|dm us)\b/i;

// Fields are split on "|"; frames written as "Name - detail - register by 4 Nov" split on " - ".
const splitFields = (text) =>
  (text.includes("|") ? text.split("|") : text.split(/\s+[-–]\s+/)).map((f) => f.trim()).filter(Boolean);

// "Slide 1: Title | Subtitle"        → { variant, fields: ["Title", "Subtitle"] }
// "Slide 3 (cta): Follow | for more" → variant forced to "cta"
// "Frame 2: Name - online - by 8 Nov" (stories) works the same way.
// Lines that don't start with "Slide/Frame N" continue the previous slide; sticker and
// design-note lines are skipped.
export function parseSlides(script = "") {
  const slides = [];
  for (const raw of String(script).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(?:slide|frame)\s*(\d+)\s*(?:\((cover|item|cta)\))?\s*[:.\-–]\s*(.*)$/i);
    if (m) {
      if (NOT_A_SLIDE.test(m[3])) continue;
      slides.push({ n: Number(m[1]), forced: m[2]?.toLowerCase(), text: m[3] });
    } else if (slides.length && !NOT_A_SLIDE.test(line)) {
      slides[slides.length - 1].text += ` | ${line}`;
    }
  }
  if (slides.length === 0 && script.trim()) slides.push({ n: 1, text: script.trim() });

  return slides.map((s, i) => {
    const isLast = i === slides.length - 1 && slides.length >= 2;
    return {
      variant: s.forced || (i === 0 ? "cover" : isLast && LOOKS_LIKE_CTA.test(s.text) ? "cta" : "item"),
      fields: splitFields(s.text),
    };
  });
}

// Reel scripts: "HOOK (0-3s): …", "POINT 1 (3-18s): …", "CTA (48-60s): …".
// Timings in brackets are optional and set how long each card is shown when there is no voiceover.
// A "VO: …" line after a card is what the voice says for it (default: the card's own text).
export function parseReelScript(script = "") {
  const cards = [];
  for (const raw of String(script).split(/\r?\n/)) {
    const vo = raw.trim().match(/^(?:vo|voice\s*-?over|narration)\s*[:\-–]\s*(.+)$/i);
    if (vo && cards.length) {
      cards[cards.length - 1].voice = vo[1].trim();
      continue;
    }
    const m = raw.trim().match(/^(hook|point|cta)\s*\d*\s*(?:\(([^)]*)\))?\s*[:\-–]\s*(.+)$/i);
    if (!m) continue;
    const kind = m[1].toLowerCase();
    const t = (m[2] || "").match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*s?/);
    cards.push({ kind, text: m[3].trim(), seconds: t ? Number(t[2]) - Number(t[1]) : null });
  }
  const points = cards.filter((c) => c.kind === "point").length;
  let p = 0;
  return cards.map((c) => {
    if (c.kind === "point") {
      p += 1;
      // A statement card: the point as a headline, "2 of 3" as the kicker
      return { ...c, variant: "cover", fields: [c.text, "", `${p} of ${points}`] };
    }
    return { ...c, variant: c.kind === "hook" ? "cover" : "cta", fields: splitFields(c.text) };
  });
}

let browserPromise = null;
export async function getBrowser() {
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
