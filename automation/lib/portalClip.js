// A screen recording of a company's official job page, made in a real browser: the page opens,
// scrolls to the part that matters, a cursor moves to Apply and clicks it, and the page it leads to
// is shown. Used inside conversation reels (lib/convoReel.js). Nothing is typed, no account is
// used: the click only opens the company's own application page.
//
// steps: [{ hold: s }, { scrollTo: "Minimum Qualifications", dur: s }, { scrollTop: true, dur: s },
//         { hover: "Apply Now", dur: s }, { click: "Read more", dur: s, stay: true },
//         { click: "Apply Now", dur: s }, { hold: s }, { mark: "Education:" } (highlight, no time)]

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { getBrowser } from "./render.js";

const FPS = 30;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const HIDE_CONSENT = "#onetrust-consent-sdk, #onetrust-banner-sdk, [id*='cookie-banner' i], [class*='cookie-banner' i], [id*='consent' i][role='dialog'], #truste-consent-track { display: none !important; }";

const MARK = ";background:rgba(255,214,10,.42);border-radius:6px;box-shadow:0 0 0 6px rgba(255,214,10,.42);";

// A mouse pointer drawn into the page, since screenshots don't include the real one
const CURSOR = `
  if (!document.getElementById("__cursor")) {
    const c = document.createElement("div");
    c.id = "__cursor";
    c.style.cssText = "position:fixed;left:0;top:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;transition:none;";
    c.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><div id="__ring" style="position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:3px solid #8F86FF;opacity:0"></div>';
    document.documentElement.appendChild(c);
  }`;

// out: the size to deliver; rendering at a higher scale and shrinking keeps text crisp while it scrolls
export async function recordPortal(url, steps, file, { width = 470, height = 380, scale = 2, out, ffmpeg } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, isMobile: true, hasTouch: false });
  let page = await context.newPage();
  const size = out ? ["-vf", `scale=${out.width}:${out.height}:flags=lanczos`] : [];
  const enc = spawn(ffmpeg, ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-", ...size, "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-r", String(FPS), file], { stdio: ["pipe", "ignore", "pipe"] });
  let err = "";
  enc.stderr.on("data", (d) => (err = (err + d).slice(-3000)));
  const encoded = new Promise((resolve, reject) => enc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg: ${err.slice(-800)}`)))));

  let cdp;
  const attach = async () => {
    cdp = await context.newCDPSession(page);
  };
  const frame = async () => {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    if (!enc.stdin.write(Buffer.from(data, "base64"))) await new Promise((r) => enc.stdin.once("drain", r));
  };
  const cursorAt = (x, y, ring = 0) =>
    page.evaluate(([x, y, ring, js]) => {
      new Function(js)();
      const c = document.getElementById("__cursor");
      c.style.transform = `translate(${x}px, ${y}px)`;
      const r = document.getElementById("__ring");
      r.style.opacity = ring;
      r.style.transform = `scale(${1 + (1 - ring) * 1.4})`;
    }, [x, y, ring, CURSOR]);

  let seconds = 0;
  let cursor = { x: width * 0.7, y: height * 0.8 };
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    // Cookie banners are hidden from the recording, never accepted
    await page.addStyleTag({ content: HIDE_CONSENT }).catch(() => {});
    await attach();
    for (const step of steps) {
      const n = Math.max(1, Math.round((step.dur ?? step.hold ?? 1) * FPS));
      if (step.mark) {
        // A marker-pen highlight on the page's own text, on what's being said right now
        await page.evaluate(([text, css]) => {
          document.querySelectorAll("[data-marked]").forEach((e) => { e.style.cssText = e.dataset.marked; e.removeAttribute("data-marked"); });
          const el = [...document.querySelectorAll("body *")].find((e) => e.children.length === 0 && e.textContent.trim().startsWith(text) && e.getBoundingClientRect().height > 0)
            || [...document.querySelectorAll("body *")].reverse().find((e) => e.textContent.includes(text) && e.getBoundingClientRect().height > 0);
          if (!el) return;
          el.dataset.marked = el.style.cssText;
          el.style.cssText += css;
        }, [step.mark, MARK]);
        if (!step.dur && !step.hold) continue;
      }
      if (step.hold) {
        for (let f = 0; f < n; f++) await cursorAt(cursor.x, cursor.y).then(frame);
      } else if (step.scrollTo || step.scrollTop) {
        // Job pages often scroll an inner box rather than the window: scroll whichever holds the text
        const { from, to } = await page.evaluate(([text, top]) => {
          const el = text && [...document.querySelectorAll("body *")].find((e) => e.children.length === 0 && e.textContent.trim().startsWith(text) && e.getBoundingClientRect().height > 0);
          let box = el && el.parentElement;
          while (box && !(box.scrollHeight > box.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
          window.__scroller = box || window.__scroller || document.scrollingElement;
          const sc = window.__scroller;
          const from = sc.scrollTop;
          if (top) return { from, to: 0 };
          if (!el) return { from, to: from + 600 };
          const offset = el.getBoundingClientRect().top - (sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top);
          return { from, to: Math.min(sc.scrollHeight - sc.clientHeight, from + offset - 110) };
        }, [step.scrollTo, Boolean(step.scrollTop)]);
        for (let f = 0; f < n; f++) {
          await page.evaluate((y) => { (window.__scroller || document.scrollingElement).scrollTop = y; }, from + (to - from) * ease((f + 1) / n));
          await cursorAt(cursor.x, cursor.y).then(frame);
        }
      } else if (step.click || step.hover) {
        // The first visible element whose own text is the button's label
        const box = await page.evaluate((text) => {
          const el = [...document.querySelectorAll("a, button")].find((e) => e.innerText.trim() === text && e.getBoundingClientRect().height > 0);
          if (!el) return null;
          el.scrollIntoView({ block: "nearest" });
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, step.click || step.hover);
        if (!box) throw new Error(`"${step.click || step.hover}" isn't on the page`);
        const start = { ...cursor };
        for (let f = 0; f < n; f++) {
          const k = ease((f + 1) / n);
          cursor = { x: start.x + (box.x - start.x) * k, y: start.y + (box.y - start.y) * k };
          await cursorAt(cursor.x, cursor.y).then(frame);
        }
        // hover: the pointer rests on the button, nothing is pressed
        if (step.hover) {
          seconds += n / FPS;
          continue;
        }
        // The press: a ring on the button for a few frames, then the real click
        for (let f = 0; f < 6; f++) await cursorAt(cursor.x, cursor.y, 1 - f / 6).then(frame);
        // stay: the click opens something on the same page ("Read more"), no new page to wait for
        const popup = step.stay ? Promise.resolve(null) : context.waitForEvent("page", { timeout: 4000 }).catch(() => null);
        await page.mouse.click(box.x, box.y);
        const opened = await popup;
        if (opened) {
          page = opened;
          await attach();
        }
        if (!step.stay) await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(step.stay ? 250 : 800);
        seconds += 6 / FPS;
      }
      seconds += n / FPS;
    }
  } finally {
    enc.stdin.end();
    await context.close();
  }
  await encoded;
  return { file, seconds, width: out?.width || width * scale, height: out?.height || height * scale };
}
