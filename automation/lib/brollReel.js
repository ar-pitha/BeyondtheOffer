// Job posts (tech, govt, events) → a faceless b-roll Reel, 1080x1920 H.264, about 8 s, cut like a
// creator's edit: plain text on real footage, a few words a shot.
//   hook     "Google / is hiring freshers / ₹12 LPA"        on screen from the first frame
//   openings "Comcast / software engineer, ₹8 LPA"           about a second each, at most 3 more
//   cta      "comment [JOB] / i'll send you every link / send this to your batchmates", the DM
//            arriving as an Instagram notification from beyond_the.offer with the profile picture
// Why this shape: the first reel (Nov 18) was watched for 4.3 s on average out of 14 s, and its
// payoff came at 5 s. Instagram only shows a reel to more people when its first viewers stay and
// share, so the best opening is the first thing on screen and the whole reel fits in the time
// people actually watch.
// Every shot is a different real stock clip (lib/broll.js), cut on the music's beats
// (lib/music.js). Text is black on bright shots and white on dark ones. No voice.
// News and AI posts stay carousels (lib/post.js).

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ROOT } from "./config.js";
import { getBrowser } from "./render.js";
import { postDeck, profilePicture, EMOJI } from "./post.js";
import { pickClips } from "./broll.js";
import { pickMusic } from "./music.js";
import { ffmpegPath } from "../reels.js";

const FPS = 30;
const TEMPLATE = path.join(ROOT, "templates", "broll.html");
// The hook opening plus this many more, so the reel ends inside the time people watch
const MAX_OPENINGS = 4;
const SECONDS = { hook: 2.0, opening: 1.15, cta: 2.9 };
// The grid cover: the hook, which is on screen from the first frame
export const COVER_AT = 0.8;
export const REEL_CATEGORIES = ["tech", "govt", "events"];

const DEADLINE_LABEL = /^(apply by|last date|register by|deadline)$/i;
const FACT_LABEL = /^(stipend|salary|posts|prizes)$/i;
// Draft lines carry no labels: "Bengaluru · Stipend ₹50,000/month" → "Stipend ₹50,000/month"
const FACT_TEXT = /(stipend|salary|ctc|₹|\blpa\b|vacanc|\bposts\b|prize)/i;

const short = (s, max) => {
  const text = String(s || "").replace(EMOJI, "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = Math.max(cut.lastIndexOf(","), cut.lastIndexOf(":"), cut.lastIndexOf(" - "), cut.lastIndexOf(" ("));
  return (at > max * 0.5 ? cut.slice(0, at) : cut.replace(/\s+\S*$/, "")).trim();
};
// "13 Nov 2026" → "13 Nov"
const dayMonth = (value) => String(value).replace(/\s+\d{4}$/, "");

function factOf(card) {
  const fact = rawFact(card) && short(rawFact(card), 20);
  // Pay from an aggregator or an estimate is labelled as such, never shown as the company's figure
  return fact && card.reported && /₹|lakh|lpa|month|stipend|salary/i.test(fact) ? `${fact} (reported)` : fact;
}

function rawFact(card) {
  const labelled = card.rows?.find((r) => FACT_LABEL.test(r.label));
  if (labelled) return /^posts$/i.test(labelled.label) && /^\d[\d,]*$/.test(labelled.value) ? `${labelled.value} posts` : labelled.value;
  const value = card.rows?.find((r) => !r.label && FACT_TEXT.test(r.value))?.value;
  return value && (value.split(/\s+·\s+/).find((part) => FACT_TEXT.test(part)) || value).replace(/^(stipend|salary|ctc)\s*:?\s*/i, "");
}

// "Software Engineer Intern" → "software engineer intern"; acronyms (SDE, AI, GATE) stay as they are
const casual = (s) => s.split(/\s+/).map((w) => (/^[A-Z0-9&.+/-]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");

// "ASIC Engineer, New College Graduate 2027" → "ASIC engineer": the first clause is what you'd say
function roleOf(c) {
  const title = String(c.title || "");
  const role = !c.company ? title : title.toLowerCase().endsWith(c.company.toLowerCase()) ? title.slice(0, -c.company.length).replace(/[\s,·|-]+$/, "") : title;
  return casual(role.split(/\s*(?:,|:|\(|\s[-–]\s|\band\b|\bwith\b|\bfor\b)\s*/i)[0].split(/\s+/).slice(0, 4).join(" "));
}

// Pure: deck (lib/post.js) → scenes, each with its lines and when they come in (at 0 = already
// on screen when the shot starts). Written like a person talks: lowercase, a few words per shot.
export function planScenes(row, category, deck) {
  const every = deck.map((d) => d.slide).filter((s) => s.type === "item" && (s.company || s.title));
  if (!every.length) throw new Error("no openings to put in a reel");
  const keyword = deck.find((d) => d.slide.type === "profile")?.slide.keyword || "JOB";
  const n = every.length;
  const deadlineOf = (c) => c.rows?.find((r) => DEADLINE_LABEL.test(r.label) && r.value !== "Open until filled");
  const line = (style, text, at) => ({ type: "line", style, text, at });

  // The first opening leads: the daily task lists the biggest name first
  const lead = every[0];
  const rest = every.filter((c) => c !== lead).slice(0, MAX_OPENINGS - 1);
  const leadFact = factOf(lead);
  const intern = /intern|apprentice/i.test(lead.title);
  const hook = {
    kind: "hook",
    items: [
      line("bold", short(lead.company || lead.title, 20), 0),
      line("bold", category === "events" ? "is open for teams" : category === "govt" ? "is hiring" : `is hiring ${intern ? "interns" : "freshers"}`, 0),
      line("ital", leadFact || roleOf(lead) || "apply now", 0.35),
      n > 1 && line("sub", `+ ${n - 1} more`, 0.9),
    ].filter(Boolean),
  };

  const openings = rest.map((c) => {
    const fact = factOf(c);
    const deadline = deadlineOf(c);
    const detail = [roleOf(c), fact].filter(Boolean).join(", ");
    return {
      kind: "opening",
      items: [
        line("bold", short(c.company || c.title, 22), 0),
        detail && line("sub", detail, 0.12),
        !fact && deadline && line("sub", `closes ${dayMonth(deadline.value)}`, 0.3),
      ].filter(Boolean),
    };
  });

  const cta = {
    kind: "cta",
    items: [
      line("ital", "comment", 0),
      { type: "chips", chips: [keyword], at: 0.2 },
      line("sub", `i'll send you ${n === 1 ? "the link" : "every link"}`, 0.45),
      { type: "notify", name: "beyond_the.offer", text: `sent you ${n === 1 ? "the apply link" : `${n} apply links`}`, at: 0.85 },
      // The one post that reached non-followers asked for this; shares are what Instagram pushes
      line("sub", "send this to your batchmates", 1.3),
    ],
  };
  return [hook, ...openings, cta];
}

// Scene lengths from SECONDS, each cut moved onto the nearest beat within 0.25 s
export function timeScenes(scenes, beats = []) {
  let start = 0;
  let planned = 0;
  return scenes.map((s, i) => {
    planned += SECONDS[s.kind];
    let end = planned;
    if (i < scenes.length - 1) {
      const near = beats.filter((b) => Math.abs(b - planned) <= 0.25).sort((a, b) => Math.abs(a - planned) - Math.abs(b - planned))[0];
      if (near && near - start >= 0.9) end = near;
    }
    const scene = { ...s, start, dur: Number((end - start).toFixed(3)) };
    start = end;
    return scene;
  });
}

// Hands at work from the first frame (motion holds the eye), coffee now and then, someone seen
// from behind to close
const shotKinds = (scenes) =>
  scenes.map((s, i) => (s.kind === "cta" ? "cta" : s.kind === "opening" && i % 3 === 2 ? "coffee" : "work"));

function hash(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

function run(cmd, args, { stdout = "ignore" } = {}) {
  const p = spawn(cmd, args, { stdio: ["pipe", stdout, "pipe"] });
  let err = "";
  const out = [];
  if (stdout === "pipe") p.stdout.on("data", (d) => out.push(d));
  p.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
  const done = new Promise((resolve, reject) => {
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-1500)}`))));
  });
  return { proc: p, done };
}

// The darkest part of where the text sits (a 4x3 grid over y 200-720), 0-255. Black text only
// reads when all of it is bright; one dark corner swallows it.
async function textAreaMin(ffmpeg, file, at) {
  const { proc, done } = run(ffmpeg, ["-v", "error", "-ss", at.toFixed(2), "-i", file, "-frames:v", "1",
    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,crop=1080:520:0:200,scale=4:3", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { stdout: "pipe" });
  proc.stdin.end();
  const buf = await done.catch(() => Buffer.alloc(0));
  return buf.length ? Math.min(...buf) : 0;
}

export async function buildJobReel(row, outDir, { category = "tech", items, variant = 0 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const { deck, items: kept, left } = await postDeck(row, { category, items });
  // Cards come in the same order as the sheet rows they were made from
  const cards = deck.map((d) => d.slide).filter((sl) => sl.type === "item");
  if (cards.length === kept.length) {
    kept.forEach((item, i) => (cards[i].reported = /unofficial|aggregator|expected|estimate|\bper [a-z]/i.test(`${item.Salary_Stipend || ""} ${item.Prizes_Perks || ""}`)));
  }
  const seed = `${row.ID}|${variant}`;
  const ffmpeg = await ffmpegPath();
  const music = await pickMusic(seed, ffmpeg);
  const scenes = timeScenes(planScenes(row, category, deck), music.beats);
  const total = scenes.reduce((sum, s) => sum + s.dur, 0);
  const clips = await pickClips(shotKinds(scenes), seed, ffmpeg);

  // A different stretch of each shot per post, away from its first and last second
  const offsets = scenes.map((s, i) => {
    const room = Math.max(0, clips[i].duration - s.dur - 2);
    return 1 + (room ? (hash(`${seed}|${i}`) % Math.floor(room * 10)) / 10 : 0);
  });
  // Black text on bright shots, white on dark ones; the profile picture for the DM
  const picture = await profilePicture().catch(() => null);
  for (const [i, s] of scenes.entries()) {
    s.ink = (await textAreaMin(ffmpeg, clips[i].file, offsets[i] + s.dur / 2)) > 125 ? "dark" : "light";
    for (const item of s.items) if (item.type === "notify") item.picture = picture;
  }

  const file = path.join(outDir, "reel.mp4");
  const args = ["-y"];
  scenes.forEach((s, i) => args.push("-ss", offsets[i].toFixed(2), "-t", (s.dur + 0.2).toFixed(2), "-i", clips[i].file));
  const textInput = scenes.length;
  const audioInput = scenes.length + 1;
  args.push("-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-");
  args.push("-ss", music.start.toFixed(2), "-i", music.file);

  const shots = scenes
    .map(
      (s, i) =>
        `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=${FPS},setsar=1,` +
        // A slow push-in on every shot, like a handheld phone settling
        `zoompan=z='min(1+0.0009*on,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=${FPS},` +
        `trim=duration=${s.dur},setpts=PTS-STARTPTS,eq=contrast=1.04:saturation=0.92:brightness=0.01[v${i}]`
    )
    .join(";");
  const graph =
    `${shots};${scenes.map((_, i) => `[v${i}]`).join("")}concat=n=${scenes.length}:v=1:a=0[bg];` +
    `[bg][${textInput}:v]overlay=0:0:format=auto,noise=alls=5:allf=t,format=yuv420p[v];` +
    `[${audioInput}:a]atrim=0:${total},asetpts=PTS-STARTPTS,afade=t=in:d=0.15,afade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8,volume=0.9[a]`;
  args.push(
    "-filter_complex", graph,
    "-map", "[v]", "-map", "[a]", "-t", total.toFixed(2),
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-maxrate", "9M", "-bufsize", "18M", "-profile:v", "high",
    "-r", String(FPS), "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-movflags", "+faststart",
    file
  );

  const { proc, done } = run(ffmpeg, args);
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const cdp = await page.context().newCDPSession(page);
  try {
    await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: "networkidle" }).catch(() => page.goto(pathToFileURL(TEMPLATE).href));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((d) => window.setup(d), { scenes });
    await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    // Paint the hook once before recording, so frame 0 (what people see before they decide) has it
    await page.evaluate(() => window.seek(0));
    await page.waitForTimeout(150);
    const frames = Math.ceil(total * FPS);
    for (let f = 0; f < frames; f++) {
      await page.evaluate((t) => window.seek(t), f / FPS);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
      if (!proc.stdin.write(Buffer.from(data, "base64"))) await new Promise((r) => proc.stdin.once("drain", r));
    }
  } finally {
    proc.stdin.end();
    await cdp.detach().catch(() => {});
    await page.close();
  }
  await done;

  const cover = path.join(outDir, "cover.jpg");
  const shot = run(ffmpeg, ["-y", "-ss", String(COVER_AT), "-i", file, "-frames:v", "1", "-q:v", "2", cover]);
  shot.proc.stdin.end();
  await shot.done;

  return { file, cover, seconds: total, scenes, clips, track: music.title, left };
}
