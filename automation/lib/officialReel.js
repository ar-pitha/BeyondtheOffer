// Official-page reel, 1080x1920 H.264: one calm voice explains an opening in plain sentences.
//   1. intro   a white card, a few words in the carousel's serif ("Qualcomm / is hiring the 2027 batch")
//   2. page    the company's real job page, recorded live: the pointer rests on Apply, the page
//              scrolls to each fact as it's said. Nothing is drawn on top of the website.
//   3. outro   the carousel's profile card (Follow, "Comment JOB"); outro.dm adds the DM banner
// Every fact said must be on the page being shown. Nothing here uploads or posts.
//
// Script JSON (automation/scripts/*.official.json):
//   { "id", "url", "voice"?, "keyword"?: "JOB",
//     "intro": { "lines": ["*Qualcomm*", "is hiring the 2027 batch"], "say": "Qualcomm is hiring the 2027 batch." },
//     "lines": [ { "say": "...", "do": [ portalClip.js steps ] } ],
//     "outro": { "say": "...", "dm"?: "sent you the apply link" },
//     "thumb"?: { "company", "link", "batch": "2027", "band"?: "Campus Hiring 2027", "role" } }   → cover.jpg

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ROOT } from "./config.js";
import { getBrowser } from "./render.js";
import { profilePicture } from "./post.js";
import { logoFor } from "./logos.js";
import { pickMusic } from "./music.js";
import { EdgeTTS } from "node-edge-tts";
import { probeSeconds } from "./voice.js";
import { recordPortal } from "./portalClip.js";
import { ffmpegPath } from "../reels.js";

const FPS = 30;
const CARD = path.join(ROOT, "templates", "card.html");
const THUMB = path.join(ROOT, "templates", "thumb.html");
// A warm, natural Indian-English voice at a brisk pace; OFFICIAL_VOICE / OFFICIAL_RATE override it
const VOICE = process.env.OFFICIAL_VOICE || "en-IN-NeerjaNeural";
const RATE = process.env.OFFICIAL_RATE || "+14%";
// The breath between one sentence and the next
const GAP = 0.1;
const PRESS = 6 / FPS;
const stepTime = (s) => (s.hold ?? s.dur ?? 0) + (s.click ? PRESS : 0);
const words = (s) => s.replace(/\*/g, "").split(/\s+/).filter(Boolean);

function run(cmd, args, input = false) {
  const p = spawn(cmd, args, { stdio: [input ? "pipe" : "ignore", "ignore", "pipe"] });
  let err = "";
  p.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
  const done = new Promise((resolve, reject) => {
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-1500)}`))));
  });
  return { proc: p, done };
}

// One line → mp3 plus each word's start (s). The free Edge endpoint drops connections, so retry.
async function voiceLine(text, file, voice, ffmpeg, rate = RATE) {
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      const tts = new EdgeTTS({ voice, lang: voice.slice(0, 5), rate, outputFormat: "audio-24khz-96kbitrate-mono-mp3", saveSubtitles: true, timeout: 30_000 });
      await tts.ttsPromise(text, file);
      const words = JSON.parse(fs.readFileSync(`${file}.json`, "utf8")).map((w) => ({ text: w.part.trim(), at: w.start / 1000 }));
      const seconds = await probeSeconds(ffmpeg, file);
      if (!seconds) throw new Error("empty audio");
      return { seconds, words };
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw new Error(`voiceover failed: ${last?.message || last}`);
}

// The voice clips come with ~0.2 s of silence before the words and ~0.7 s after, which made a full
// second of dead air between sentences. Keep a short breath at each end instead.
async function spoken(text, file, voice, ffmpeg, rate) {
  const raw = file.replace(/\.mp3$/, "-raw.mp3");
  const { words } = await voiceLine(text, raw, voice, ffmpeg, rate);
  const out = file.replace(/\.mp3$/, ".wav");
  const trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04";
  await run(ffmpeg, ["-y", "-i", raw, "-af", `${trim},areverse,${trim.replace("0.04", "0.1")},areverse`, "-ar", "44100", out]).done;
  const seconds = await probeSeconds(ffmpeg, out);
  const shift = Math.max(0, (words[0]?.at ?? 0.04) - 0.04);
  return { file: out, seconds, words: words.map((w) => ({ ...w, at: Math.max(0, w.at - shift) })) };
}

// An animated card (templates/card.html) → mp4, frame by frame
async function renderCard(data, seconds, file, ffmpeg) {
  const { proc, done } = run(ffmpeg, ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(FPS), file], true);
  const page = await (await getBrowser()).newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const cdp = await page.context().newCDPSession(page);
  try {
    await page.goto(pathToFileURL(CARD).href, { waitUntil: "networkidle" }).catch(() => page.goto(pathToFileURL(CARD).href));
    await page.evaluate((d) => window.setup(d), data);
    await page.evaluate(() => window.seek(0));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    for (let f = 0; f < Math.ceil(seconds * FPS); f++) {
      await page.evaluate((t) => window.seek(t), f / FPS);
      const { data: jpg } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
      if (!proc.stdin.write(Buffer.from(jpg, "base64"))) await new Promise((r) => proc.stdin.once("drain", r));
    }
  } finally {
    proc.stdin.end();
    await cdp.detach().catch(() => {});
    await page.close();
  }
  await done;
}

// The reel's cover (templates/thumb.html): the company's real logo, "Campus Hiring <batch>", the role
export async function renderThumb(t, file) {
  const logo = await logoFor({ name: t.company, link: t.link }).catch(() => null);
  const page = await (await getBrowser()).newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  try {
    await page.goto(pathToFileURL(THUMB).href, { waitUntil: "networkidle" }).catch(() => page.goto(pathToFileURL(THUMB).href));
    await page.evaluate((d) => window.render(d), { ...t, logo });
    await page.screenshot({ path: file, type: "jpeg", quality: 94 });
  } finally {
    await page.close();
  }
  return file;
}

export async function buildOfficialReel(script, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const ffmpeg = await ffmpegPath();
  const voice = script.voice || VOICE;
  const keyword = script.keyword || "JOB";
  const voices = [];

  // 1. Intro: each line of text comes in when its first word is spoken
  const intro = await spoken(script.intro.say, path.join(outDir, "v-intro.mp3"), voice, ffmpeg, script.rate || RATE);
  let k = 0;
  const at = script.intro.lines.map((line) => {
    const t = k === 0 ? 0 : intro.words[k]?.at ?? 0;
    k += words(line).length;
    return t;
  });
  const introDur = intro.seconds + GAP + 0.1;
  voices.push({ file: intro.file, start: 0.15 });
  await renderCard({ kind: "intro", lines: script.intro.lines, at: at.map((t, i) => (i === 0 ? 0 : t + 0.15)) }, introDur, path.join(outDir, "part-1.mp4"), ffmpeg);

  // 2. The page: each sentence lasts as long as the longer of its words and its scrolling
  let start = introDur + 0.25; // the page is on screen a beat before she goes on
  const steps = [{ hold: 0.25 }];
  for (const [i, l] of script.lines.entries()) {
    const { file, seconds } = await spoken(l.say, path.join(outDir, `v-${String(i + 1).padStart(2, "0")}.mp3`), voice, ffmpeg, script.rate || RATE);
    const acting = (l.do || []).reduce((sum, s) => sum + stepTime(s), 0);
    const span = Math.max(seconds + GAP, acting);
    steps.push(...(l.do || []));
    if (span - acting > 0.02) steps.push({ hold: Number((span - acting).toFixed(3)) });
    voices.push({ file, start });
    start += span;
  }
  const page = await recordPortal(script.url, steps, path.join(outDir, "part-2.mp4"), { width: 360, height: 640, scale: 4, out: { width: 1080, height: 1920 }, ffmpeg });
  const pageDur = start - introDur;

  // 3. Outro: the profile card, then the DM
  const outro = await spoken(script.outro.say, path.join(outDir, "v-outro.mp3"), voice, ffmpeg, script.rate || RATE);
  const outroDur = Math.max(2.5, outro.seconds + 0.45);
  voices.push({ file: outro.file, start: start + 0.15 });
  const picture = await profilePicture().catch(() => null);
  await renderCard({ kind: "outro", handle: "beyond_the.offer", line: "Verified openings for freshers, every day.", keyword, dm: script.outro.dm || "", dmAt: 0.7, picture }, outroDur, path.join(outDir, "part-3.mp4"), ffmpeg);
  const total = start + outroDur;

  const music = await pickMusic(script.id, ffmpeg);
  const file = path.join(outDir, "reel.mp4");
  const args = ["-y", "-i", path.join(outDir, "part-1.mp4"), "-i", page.file, "-i", path.join(outDir, "part-3.mp4"), "-ss", music.start.toFixed(2), "-i", music.file];
  voices.forEach((v) => args.push("-i", v.file));
  const mix = voices.map((v, i) => `[${4 + i}:a]adelay=${Math.round(v.start * 1000)}:all=1,apad[s${i}]`).join(";");
  const graph =
    `[0:v]trim=duration=${introDur.toFixed(3)},setpts=PTS-STARTPTS,setsar=1[a0];` +
    `[1:v]scale=1080:1920,setsar=1,tpad=stop_mode=clone:stop_duration=2,trim=duration=${pageDur.toFixed(3)},setpts=PTS-STARTPTS[a1];` +
    `[2:v]trim=duration=${outroDur.toFixed(3)},setpts=PTS-STARTPTS,setsar=1[a2];` +
    `[a0][a1][a2]concat=n=3:v=1:a=0,format=yuv420p[v];` +
    `${mix};${voices.map((_, i) => `[s${i}]`).join("")}amix=inputs=${voices.length}:normalize=0:duration=longest,volume=1.6[vo];` +
    `[3:a]atrim=0:${total},asetpts=PTS-STARTPTS,volume=0.08,afade=t=in:d=0.3,afade=t=out:st=${(total - 1).toFixed(2)}:d=1[bed];` +
    `[vo][bed]amix=inputs=2:normalize=0:duration=first,atrim=0:${total}[a]`;
  args.push(
    "-filter_complex", graph, "-map", "[v]", "-map", "[a]", "-t", total.toFixed(2),
    // High bitrate going in, since Instagram compresses it again
    "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-movflags", "+faststart", file
  );
  const mixed = run(ffmpeg, args);
  await mixed.done;
  // The cover: the designed thumbnail when the script describes one, else a frame of the intro
  const cover = path.join(outDir, "cover.jpg");
  if (script.thumb) await renderThumb(script.thumb, cover);
  else await run(ffmpeg, ["-y", "-ss", "0.6", "-i", file, "-frames:v", "1", "-q:v", "2", cover]).done;
  return { file, cover, seconds: total, parts: { intro: introDur, page: pageDur, outro: outroDur }, voice, track: music.title };
}
