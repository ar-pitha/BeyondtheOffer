// Job posts (tech, govt, events) → a faceless b-roll Reel, 1080x1920 H.264, 15-20 s, cut like a
// creator edit:
//   hook    "No ~referrals.~ / No cold emails."            (pink strike through the first line)
//   promise "NVIDIA & Microsoft / + 3 more hiring / freshers, official apply links"
//   cards   one white company card per opening (logo, role, tags), the pay as the headline
//   cta     "just comment [JOB]" and a "beyond_the.offer sent you 5 apply links" banner
// Every scene is a different real stock shot (lib/broll.js), cut on the music's beats
// (lib/music.js). Text is black on bright shots and white on dark ones. No voice.
// News and AI posts stay carousels (lib/post.js).

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ROOT } from "./config.js";
import { getBrowser } from "./render.js";
import { postDeck, profilePicture, EMOJI } from "./post.js";
import { logoFor } from "./logos.js";
import { pickClips } from "./broll.js";
import { pickMusic } from "./music.js";
import { ffmpegPath } from "../reels.js";

const FPS = 30;
const TEMPLATE = path.join(ROOT, "templates", "broll.html");
const MAX_OPENINGS = 5;
const SECONDS = { hook: 2.5, promise: 2.6, card: 2.0, cta: 3.6 };
// The grid cover: the hook once both lines and the strike are in
export const COVER_AT = 1.9;
export const REEL_CATEGORIES = ["tech", "govt", "events"];
const HOOK = {
  tech: ["No ~referrals.~", "No cold emails."],
  govt: ["No ~agents.~", "No fake links."],
  events: ["No ~spam.~", "Just real hackathons."],
};
const NOUN = { tech: "companies", govt: "govt jobs", events: "hackathons" };

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
  const labelled = card.rows?.find((r) => FACT_LABEL.test(r.label));
  if (labelled) return /^posts$/i.test(labelled.label) && /^\d[\d,]*$/.test(labelled.value) ? `${labelled.value} posts` : labelled.value;
  const value = card.rows?.find((r) => !r.label && FACT_TEXT.test(r.value))?.value;
  return value && (value.split(/\s+·\s+/).find((part) => FACT_TEXT.test(part)) || value).replace(/^(stipend|salary|ctc)\s*:?\s*/i, "");
}

const rowValue = (card, label) => card.rows?.find((r) => r.label.toLowerCase() === label)?.value;

// Pure: deck (lib/post.js) → scenes, each with its lines/chips/card and when they come in
export function planScenes(row, category, deck) {
  const cards = deck.map((d) => d.slide).filter((s) => s.type === "item" && (s.company || s.title)).slice(0, MAX_OPENINGS);
  if (!cards.length) throw new Error("no openings to put in a reel");
  const keyword = deck.find((d) => d.slide.type === "profile")?.slide.keyword || "JOB";
  const n = cards.length;
  const deadlineOf = (c) => c.rows?.find((r) => DEADLINE_LABEL.test(r.label) && r.value !== "Open until filled");
  const interns = cards.every((c) => /intern/i.test(c.title));
  // A post that mixes company roles with a government exam is just "openings"
  const kinds = new Set(String(row.Item_IDs || "").toUpperCase().split(/[,\s]+/).filter(Boolean).map((id) => id.slice(0, 3)));
  const mixed = kinds.size > 1;
  const first = cards
    .map(deadlineOf)
    .filter(Boolean)
    .map((r) => ({ d: r.value, t: Date.parse(r.value) }))
    .filter((x) => !Number.isNaN(x.t))
    .sort((a, b) => a.t - b.t)[0];

  const line = (style, text, at) => ({ type: "line", style, text, at });
  const hook = { kind: "hook", items: (HOOK[mixed ? "tech" : category] || HOOK.tech).map((t, i) => line("bold", t, 0.12 + i * 0.8)) };

  // Names a student knows stop the scroll better than a count
  const names = [...new Set(cards.map((c) => c.company).filter(Boolean))];
  let promise;
  if (category === "tech" && !mixed && names.length) {
    const two = names.length > 1 && `${names[0]} & ${names[1]}`.length <= 20;
    const shown = two ? 2 : 1;
    promise = [
      line("ital", two ? `${names[0]} & ${names[1]}` : names[0], 0.1),
      line("bold", n > shown ? `+ ${n - shown} more hiring` : shown > 1 ? "are hiring" : "is hiring", 0.55),
      line("sub", `${interns ? "interns" : "freshers"}, with the official apply links`, 1.0),
    ];
  } else {
    promise = [
      line("ital", `${n} ${mixed ? "openings" : NOUN[category] || "openings"}`, 0.1),
      line("bold", "open right now", 0.55),
      line("sub", first ? `the first one closes ${dayMonth(first.d)}` : "with the official apply links", 1.0),
    ];
  }

  const cardScenes = cards.map((c, k) => {
    const fact = factOf(c);
    const deadline = deadlineOf(c);
    const title = String(c.title || "");
    // "Graduate Engineer Trainee, Tata Steel" under "Tata Steel" says the company twice
    const role = !c.company ? "" : title.toLowerCase().endsWith(c.company.toLowerCase()) ? title.slice(0, -c.company.length).replace(/[\s,·|-]+$/, "") : title;
    const when = deadline ? `${/register/i.test(deadline.label) ? "Register" : "Apply"} by ${dayMonth(deadline.value)}` : "Open now";
    const tags = [rowValue(c, "location"), rowValue(c, "eligibility"), fact && when !== "Open now" ? when : null]
      .filter(Boolean)
      .map((t) => short(t, 26))
      .slice(0, 3);
    return {
      kind: "card",
      lookup: c.lookup,
      items: [
        line("bold", short(fact || when, 22), 0.05),
        line("sub", `${k + 1} of ${n}`, 0.3),
        { type: "card", company: short(c.company || c.title, 30), role: c.company ? short(role, 60) : "", tags, foot: `Comment ${keyword} for the link`, at: 0.22 },
      ],
    };
  });

  const cta = {
    kind: "cta",
    items: [
      line("ital", "just comment", 0.1),
      { type: "chips", chips: [`${keyword} ✓`], at: 0.5 },
      { type: "notify", name: "beyond_the.offer", text: `sent you ${n === 1 ? "the apply link" : `${n} apply links`}`, at: 1.25 },
    ],
  };
  return [hook, { kind: "promise", items: promise }, ...cardScenes, cta];
}

// Scene lengths from SECONDS, each cut moved onto the nearest beat within 0.3 s
export function timeScenes(scenes, beats = []) {
  let start = 0;
  let planned = 0;
  return scenes.map((s, i) => {
    planned += SECONDS[s.kind];
    let end = planned;
    if (i < scenes.length - 1) {
      const near = beats.filter((b) => Math.abs(b - planned) <= 0.3).sort((a, b) => Math.abs(a - planned) - Math.abs(b - planned))[0];
      if (near && near - start >= 1.4) end = near;
    }
    const scene = { ...s, start, dur: Number((end - start).toFixed(3)) };
    start = end;
    return scene;
  });
}

// Desk work for the promise and the cards, coffee every third card, someone seen from behind to open and close
const shotKinds = (scenes) =>
  scenes.map((s, i) => (s.kind === "hook" ? "hook" : s.kind === "cta" ? "cta" : s.kind === "card" && i % 3 === 0 ? "coffee" : "work"));

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
  const { deck, left } = await postDeck(row, { category, items });
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
  // Black text on bright shots, white on dark ones; logos and the profile picture for the cards
  const picture = await profilePicture().catch(() => null);
  for (const [i, s] of scenes.entries()) {
    s.ink = (await textAreaMin(ffmpeg, clips[i].file, offsets[i] + s.dur / 2)) > 125 ? "dark" : "light";
    for (const item of s.items) {
      if (item.type === "card") item.logo = s.lookup ? await logoFor(s.lookup).catch(() => null) : null;
      if (item.type === "notify") item.picture = picture;
    }
    delete s.lookup;
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
