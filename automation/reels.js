// Reel script (HOOK / POINT / CTA lines) → cinematic 1080x1920 MP4 (H.264, 30 fps, AAC).
//   node reels.js --sample          build the sample reel from fixtures/
//   node reels.js --script file.txt build a reel from a script file
//   --category tech|govt|events|news|ai  render in that category's look
// publish.js and preview.js use buildReel() for Content_Queue rows with Format=Reel.
//
// Each card is voiced (Edge neural TTS, lib/voice.js) and the edit follows the voice: scene
// lengths come from the narration, words appear as they are spoken, and a synthesised score
// (lib/score.js) hits on every cut and ducks under the voice. Frames come from
// templates/reel.html, stepped frame by frame in Chromium and piped into ffmpeg.
//
// Looks: one per daily category (tech → browser, govt → notes, events → terminal, news → news,
// ai → cinematic). A "THEME: notes" line in the script or REEL_THEME overrides it.
// REEL_VOICE=off always builds music-only reels; REEL_ALLOW_SILENT=true does so only when TTS
// is unreachable instead of failing.
// Tracks in automation/assets/music/ (mp3/m4a/aac/wav) replace the synthesised score; see pickTrack().

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ROOT } from "./lib/config.js";
import { parseReelScript, getBrowser, closeBrowser } from "./lib/render.js";
import { narrate, evenTiming, speak, fluentLine } from "./lib/voice.js";
import { writeScore } from "./lib/score.js";

const FPS = 30;
const MAX_SECONDS = 90;
const TEMPLATE = path.join(ROOT, "templates", "reel.html");
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, "templates", "brand.json"), "utf8"));
export const THEMES = ["cinematic", "terminal", "notes", "browser", "news"];

export const CATEGORY_THEME = { tech: "browser", govt: "notes", events: "terminal", news: "news", ai: "cinematic" };

function pickTheme(script, category) {
  const named = String(script).match(/^\s*theme\s*[:\-–]\s*(\w+)/im)?.[1] || process.env.REEL_THEME;
  if (named && THEMES.includes(named.toLowerCase())) return named.toLowerCase();
  if (CATEGORY_THEME[category]) return CATEGORY_THEME[category];
  let h = 0;
  for (const ch of String(script)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return THEMES[h % THEMES.length];
}

async function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    return (await import("ffmpeg-static")).default || "ffmpeg";
  } catch {
    return "ffmpeg";
  }
}

// Silent fallback timings. Script timings ("POINT 1 (3-18s)") win, each card 2–20 s, the reel at most 90 s.
// Otherwise: hook 4 s, CTA 5 s, points share the rest so the reel lands around 36 s (min 30, max 45).
export function planDurations(cards) {
  if (cards.length && cards.every((c) => c.seconds > 0)) {
    let durations = cards.map((c) => Math.min(20, Math.max(2, c.seconds)));
    const total = durations.reduce((a, b) => a + b, 0);
    if (total > MAX_SECONDS) durations = durations.map((d) => d * (MAX_SECONDS / total));
    return durations.map((d) => +d.toFixed(2));
  }
  const points = cards.filter((c) => c.kind === "point").length;
  const fixed = cards.reduce((t, c) => t + (c.kind === "hook" ? 4 : c.kind === "cta" ? 5 : 0), 0);
  const perPoint = points ? Math.min(10, Math.max(4, (36 - fixed) / points)) : 0;
  let durations = cards.map((c) => (c.kind === "hook" ? 4 : c.kind === "cta" ? 5 : perPoint));
  const total = durations.reduce((a, b) => a + b, 0);
  const target = Math.min(45, Math.max(30, total));
  durations = durations.map((d) => +(d * (target / total)).toFixed(2));
  return durations;
}

// Music library: automation/assets/music/<category>/ first (tech, govt, events, news, ai), then
// automation/assets/music/ and automation/assets/. A different track per reel (by script and
// variant), so Regenerate also changes the song. "name@12.mp3" starts that track 12 s in,
// past a slow intro.
const AUDIO = /\.(mp3|m4a|aac|wav)$/i;
function tracksIn(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => AUDIO.test(f)).sort().map((f) => path.join(dir, f)) : [];
}
function pickTrack({ category, seed = "" } = {}) {
  const base = path.join(ROOT, "assets");
  const pool = [path.join(base, "music", category || "_"), path.join(base, "music"), base].map(tracksIn).find((list) => list.length);
  if (!pool) return null;
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const file = pool[h % pool.length];
  return { file, start: Number(path.basename(file).match(/@(\d+(?:\.\d+)?)\.\w+$/)?.[1] || 0) };
}

// REEL_VOICE=off builds music-only reels (text on screen, no narration) when a track exists
const voiceOff = () => /^(off|none|false|0)$/i.test(String(process.env.REEL_VOICE || "").trim());

function run(cmd, args, { stdin = false } = {}) {
  const p = spawn(cmd, args, { stdio: [stdin ? "pipe" : "ignore", "ignore", "pipe"] });
  let err = "";
  p.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
  const done = new Promise((resolve, reject) => {
    p.on("error", (e) =>
      reject(e.code === "ENOENT" ? new Error("ffmpeg not found: npm install (ffmpeg-static) or set FFMPEG_PATH") : e)
    );
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${err}`))));
  });
  return { proc: p, done };
}

// Lead-in before the voice starts and hold after it ends, per card kind
const LEAD = 0.3;
const TAIL = { hook: 0.45, point: 0.85, cta: 2.4 };

// Comment keywords the auto-reply understands (frontend/api/_lib/replies.js)
const KEYWORD = { tech: "JOB", govt: "JOB", events: "LINK", news: "AI", ai: "AI" };

// Carousel/story slides (lib/render.js parseSlides) → reel cards. Stories get a hook and a CTA
// when the draft has none, so the video opens and closes like a reel.
export function slidesToCards(slides, { title = "", category = "tech", complete = false } = {}) {
  const cards = slides.map((s) => ({
    kind: s.variant === "cover" ? "hook" : s.variant === "cta" ? "cta" : "point",
    text: s.fields.join(" | "),
    seconds: null,
  }));
  if (complete && cards[0]?.kind !== "hook") cards.unshift({ kind: "hook", text: title || "Today's update", seconds: null });
  if (complete && cards[cards.length - 1]?.kind !== "cta") {
    cards.push({ kind: "cta", text: `Follow @beyond_the.offer for daily updates | Comment ${KEYWORD[category] || "LINK"} for the links`, seconds: null });
  }
  return cards;
}

// Carousel slides: each card as a finished still in the category's look (1080x1350 JPEG)
export async function renderPostSlides(slides, outDir, { category, script = "" } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const cards = slidesToCards(slides, { category });
  const points = cards.filter((c) => c.kind === "point").length;
  let p = 0;
  const scenes = cards.map((c, i) => {
    if (c.kind === "point") p += 1;
    return {
      kind: c.kind, start: i * 3, dur: 3, voiceAt: i * 3 + 0.3, voiceDur: 1,
      tokens: evenTiming(narrate(c.text).tokens, 1), structured: c.text.includes("|"),
      index: c.kind === "point" ? p : 0, count: points,
    };
  });
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: "networkidle" }).catch(() => page.goto(pathToFileURL(TEMPLATE).href));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((d) => window.setupReel(d), {
    brand, total: scenes.length * 3, today: today.getTime(), kicker: process.env.REEL_KICKER || "this week, for freshers",
    theme: pickTheme(script, category), category: category || "tech", format: "post", still: true, scenes,
  });
  await page.evaluate(() => document.fonts.ready);
  const files = [];
  for (let i = 0; i < scenes.length; i++) {
    // 2.5 s into a 3 s card: everything has animated in and nothing has started leaving
    await page.evaluate((t) => window.seek(t), scenes[i].start + 2.5);
    const file = path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
    files.push(file);
  }
  await page.close();
  return files;
}

// Said before each point (not shown), so it sounds like a person walking through a list
function connector(c, cards) {
  if (c.kind !== "point" || c.voice) return "";
  const points = cards.filter((x) => x.kind === "point");
  if (points.length < 2) return "";
  const i = points.indexOf(c);
  return i === 0 ? "First up," : i === points.length - 1 ? "And finally," : i === 1 ? "Next," : "Also,";
}

async function voiceCards(cards, outDir, ffmpeg, { rate, category } = {}) {
  const voiced = [];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const file = path.join(outDir, "voice", `vo-${String(i + 1).padStart(2, "0")}.mp3`);
    // Cards made of fields (stories, carousels) are said as sentences, not read field by field
    const line = c.voice || (c.kind === "point" && c.text.includes("|") ? fluentLine(c.text, { category }) : "");
    const vo = await speak(line || c.text, file, { ffmpeg, rate, prefix: connector(c, cards) });
    // A separate VO line can't be matched word for word, so spread the on-screen words over it
    const tokens = line ? evenTiming(narrate(c.text).tokens, vo.seconds * 0.9) : vo.tokens;
    voiced.push({ ...c, tokens, voiceFile: vo.file, voiceDur: vo.seconds });
  }
  return voiced;
}

function timeline(cards, silent) {
  const durations = silent ? planDurations(cards) : null;
  const points = cards.filter((c) => c.kind === "point").length;
  let start = 0;
  let p = 0;
  return cards.map((c, i) => {
    const dur = silent ? durations[i] : Math.max(2.4, LEAD + c.voiceDur + TAIL[c.kind]);
    const voiceDur = silent ? dur * 0.75 : c.voiceDur;
    const tokens = silent ? evenTiming(narrate(c.text).tokens, voiceDur) : c.tokens;
    if (c.kind === "point") p += 1;
    const scene = {
      kind: c.kind,
      start: +start.toFixed(3),
      dur: +dur.toFixed(3),
      voiceAt: +(start + LEAD).toFixed(3),
      voiceDur,
      voiceFile: c.voiceFile,
      tokens,
      structured: c.text.includes("|"),
      index: c.kind === "point" ? p : 0,
      count: points,
    };
    start += dur;
    return scene;
  });
}

async function renderFrames(scenes, total, file, ffmpeg, { theme, category, variant = 0 }) {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: "networkidle" }).catch(() => page.goto(pathToFileURL(TEMPLATE).href));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const data = {
    brand,
    total,
    today: today.getTime(),
    kicker: process.env.REEL_KICKER || "this week, for freshers",
    theme,
    category,
    variant,
    scenes: scenes.map(({ voiceFile, ...s }) => s),
  };
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((d) => window.setupReel(d), data);
  await page.evaluate(() => document.fonts.ready);

  const { proc, done } = run(ffmpeg, [
    "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    // Light film grain, then H.264 capped well under Instagram's limits
    "-vf", "noise=alls=7:allf=t,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-maxrate", "9M", "-bufsize", "18M", "-profile:v", "high",
    "-r", String(FPS), file,
  ], { stdin: true });
  const frames = Math.ceil(total * FPS);
  // Raw CDP capture is ~4x faster than page.screenshot() for a full 1080x1920 frame
  const cdp = await page.context().newCDPSession(page);
  try {
    for (let f = 0; f < frames; f++) {
      await page.evaluate((t) => window.seek(t), f / FPS);
      const { data: jpg } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92, optimizeForSpeed: true });
      if (!proc.stdin.write(Buffer.from(jpg, "base64"))) await new Promise((r) => proc.stdin.once("drain", r));
    }
  } finally {
    await cdp.detach().catch(() => {});
    proc.stdin.end();
    await page.close();
  }
  await done;
}

async function mixAudio({ scenes, total, video, output, outDir, ffmpeg, theme, variant = 0, category, seed = "" }) {
  const picked = pickTrack({ category, seed: `${seed}|${variant}` });
  const track = picked?.file;
  const bed = track || writeScore(path.join(outDir, "score.wav"), { seconds: total, cuts: scenes.map((s) => s.start), mood: theme, variant });
  const voices = scenes.filter((s) => s.voiceFile);

  const args = ["-y", "-i", video];
  if (track) args.push("-stream_loop", "-1", ...(picked.start ? ["-ss", String(picked.start)] : []));
  args.push("-i", bed);
  voices.forEach((s) => args.push("-i", s.voiceFile));

  const fmt = "aformat=sample_rates=44100:channel_layouts=stereo";
  let graph;
  if (voices.length) {
    const vo = voices
      .map((s, i) =>
        `[${i + 2}:a]${fmt},highpass=f=90,acompressor=threshold=0.125:ratio=3:attack=5:release=120:makeup=2,` +
        `adelay=${Math.round(s.voiceAt * 1000)}:all=1,apad=whole_dur=${total}[v${i}]`
      )
      .join(";");
    graph =
      `${vo};${voices.map((_, i) => `[v${i}]`).join("")}amix=inputs=${voices.length}:normalize=0:duration=longest,asplit[vo][key];` +
      `[1:a]${fmt},volume=${track ? 0.5 : 0.8},atrim=0:${total}[bed];` +
      `[bed][key]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350[duck];` +
      `[duck][vo]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,` +
      `afade=t=out:st=${Math.max(0, total - 1.2)}:d=1.2[a]`;
  } else {
    graph = `[1:a]${fmt},atrim=0:${total},loudnorm=I=-15:TP=-1.5:LRA=11,afade=t=out:st=${Math.max(0, total - 1.5)}:d=1.5[a]`;
  }

  args.push(
    "-filter_complex", graph,
    "-map", "0:v", "-map", "[a]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
    "-movflags", "+faststart", "-t", String(total),
    output
  );
  await run(ffmpeg, args).done;
  return track;
}

export async function buildReel(script, outDir, { category, cards: given, variant = 0 } = {}) {
  const cards = given || parseReelScript(script);
  if (cards.length < 2) throw new Error("Reel script needs at least a HOOK and a CTA line");
  fs.mkdirSync(outDir, { recursive: true });
  const ffmpeg = await ffmpegPath();

  let voiced = null;
  // Music-only needs a real track; without one the reel keeps its voiceover rather than
  // going out with just the synthesised bed
  const musicOnly = voiceOff() && Boolean(pickTrack({ category, seed: script }));
  if (voiceOff() && !musicOnly) console.warn("REEL_VOICE=off but no track in automation/assets/music/; using the voiceover");
  if (!musicOnly) try {
    voiced = await voiceCards(cards, outDir, ffmpeg, { category });
    // Too long for a reel: one faster take before giving up
    if (timeline(voiced, false).reduce((t, s) => t + s.dur, 0) > MAX_SECONDS) voiced = await voiceCards(cards, outDir, ffmpeg, { rate: "+22%", category });
  } catch (err) {
    if (String(process.env.REEL_ALLOW_SILENT).toLowerCase() !== "true") throw err;
    console.warn(`${err.message}; building the reel without a voiceover (REEL_ALLOW_SILENT=true)`);
  }

  const scenes = timeline(voiced || cards, !voiced);
  const total = +scenes.reduce((t, s) => t + s.dur, 0).toFixed(2);
  if (total > MAX_SECONDS) throw new Error(`Reel would run ${total}s; Instagram reels from the API max out at ${MAX_SECONDS}s`);

  const theme = pickTheme(script, category);
  const video = path.join(outDir, "video.mp4");
  const output = path.join(outDir, "reel.mp4");
  await renderFrames(scenes, total, video, ffmpeg, { theme, category: category || "tech", variant });
  const track = await mixAudio({ scenes, total, video, output, outDir, ffmpeg, theme, variant, category, seed: script });
  fs.rmSync(video, { force: true });
  // Where the closing card starts, so platforms without the Instagram ending can cut it off
  const last = scenes[scenes.length - 1];
  const ctaAt = last.kind === "cta" ? last.start : null;
  return { file: output, seconds: total, cards: cards.length, track: track ? path.basename(track) : "score", voice: !!voiced, theme, ctaAt };
}

// The reel without its Instagram ending (profile card, "comment JOB"), for YouTube Shorts.
// Cuts just before the last card starts to leave, with a short audio fade.
export async function trimBeforeCta(input, output, ctaAt) {
  const end = Math.max(3, ctaAt - 0.3);
  const ffmpeg = await ffmpegPath();
  await run(ffmpeg, [
    "-y", "-i", input, "-t", end.toFixed(2),
    "-af", `afade=t=out:st=${Math.max(0, end - 0.5).toFixed(2)}:d=0.5`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output,
  ]).done;
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const scriptArg = argv.indexOf("--script");
  const script =
    scriptArg >= 0
      ? fs.readFileSync(argv[scriptArg + 1], "utf8")
      : JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures", "content-queue.sample.json"), "utf8")).find(
          (r) => r.Format === "Reel"
        ).Slides_or_Script;
  const outDir = path.join(ROOT, "renders", scriptArg >= 0 ? path.basename(argv[scriptArg + 1], path.extname(argv[scriptArg + 1])) : "sample-reel");
  try {
    const started = Date.now();
    const category = argv.includes("--category") ? argv[argv.indexOf("--category") + 1] : undefined;
    const result = await buildReel(script, outDir, { category });
    console.log(
      `Reel ready: ${result.file} (${result.seconds}s, ${result.cards} cards, theme: ${result.theme}, voice: ${result.voice ? "yes" : "no"}, ` +
      `music: ${result.track}, built in ${Math.round((Date.now() - started) / 1000)}s)`
    );
  } catch (err) {
    console.error(`reel failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await closeBrowser();
  }
}
