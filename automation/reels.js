// Reel script (HOOK / POINT / CTA lines) → 1080x1920 MP4 (H.264, 30 fps, 30–45 s).
//   node reels.js --sample          build the sample reel from fixtures/
//   node reels.js --script file.txt build a reel from a script file
// publish.js uses buildReel() for Content_Queue rows with Format=Reel.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ROOT } from "./lib/config.js";
import { parseReelScript, renderSlides, closeBrowser } from "./lib/render.js";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FADE = 0.4;

// Timings from the script ("POINT 1 (3-18s)") win, each card 2–20 s, the reel at most 90 s.
// Otherwise: hook 4 s, CTA 5 s, points share the rest so the reel lands around 36 s (min 30, max 45).
export function planDurations(cards) {
  if (cards.length && cards.every((c) => c.seconds > 0)) {
    let durations = cards.map((c) => Math.min(20, Math.max(2, c.seconds)));
    const total = durations.reduce((a, b) => a + b, 0);
    if (total > 90) durations = durations.map((d) => d * (90 / total));
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

function pickTrack() {
  const dir = path.join(ROOT, "assets");
  if (!fs.existsSync(dir)) return null;
  const track = fs.readdirSync(dir).find((f) => /\.(mp3|m4a|aac|wav)$/i.test(f));
  return track ? path.join(dir, track) : null;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    p.on("error", (e) =>
      reject(e.code === "ENOENT" ? new Error("ffmpeg not found: install it or set FFMPEG_PATH") : e)
    );
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${err}`))));
  });
}

export async function buildReel(script, outDir) {
  const cards = parseReelScript(script);
  if (cards.length < 2) throw new Error("Reel script needs at least a HOOK and a CTA line");

  const images = await renderSlides(cards, outDir, { format: "reel", prefix: "card" });
  const durations = planDurations(cards);
  const total = +durations.reduce((a, b) => a + b, 0).toFixed(2);
  const track = pickTrack();
  const output = path.join(outDir, "reel.mp4");

  const args = ["-y"];
  images.forEach((img, i) => args.push("-loop", "1", "-framerate", "30", "-t", String(durations[i]), "-i", img));
  if (track) args.push("-stream_loop", "-1", "-i", track);
  else args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=44100:cl=stereo");

  const n = images.length;
  const video = images
    .map(
      (_, i) =>
        `[${i}:v]scale=1188:2112,crop=1080:1920:` +
        `x='(iw-1080)*${i % 2 ? "0.72" : "0.28"}':y='(ih-1920)*${i % 3 / 2}',` +
        `setsar=1,format=yuv420p,zoompan=z='min(zoom+0.0007,1.06)':` +
        `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,` +
        `fade=t=in:st=0:d=${FADE},fade=t=out:st=${(durations[i] - FADE).toFixed(2)}:d=${FADE}[v${i}]`
    )
    .join(";");
  const concat = `${images.map((_, i) => `[v${i}]`).join("")}concat=n=${n}:v=1:a=0[v]`;
  const audio = `[${n}:a]atrim=0:${total},asetpts=N/SR/TB,volume=${track ? 0.6 : 1},afade=t=out:st=${Math.max(0, total - 1.5)}:d=1.5[a]`;

  args.push(
    "-filter_complex", `${video};${concat};${audio}`,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
    "-movflags", "+faststart", "-t", String(total),
    output
  );
  await run(FFMPEG, args);
  return { file: output, seconds: total, cards: cards.length, track: track ? path.basename(track) : null };
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
    const result = await buildReel(script, outDir);
    console.log(`Reel ready: ${result.file} (${result.seconds}s, ${result.cards} cards, music: ${result.track || "none"})`);
  } catch (err) {
    console.error(`reel failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await closeBrowser();
  }
}
