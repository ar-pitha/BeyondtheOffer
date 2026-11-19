// Faceless stock footage for job reels: hands on a laptop, coffee on a desk, someone seen from
// behind. Real camera footage from Mixkit (free licence, commercial use, no credit, no API key), so
// nothing on screen looks generated. Each clip was picked by hand: no faces, no green screens.
// Clips are cached in automation/renders/_broll/ (the publish workflow caches that folder).

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT } from "./config.js";

const CACHE = path.join(ROOT, "renders", "_broll");
const OLD = (id) => `https://assets.mixkit.co/videos/${id}/${id}`;
const NEW = (id, stamp) => `https://assets.mixkit.co/active_storage/video_items/${id}/${stamp}/${id}-video`;

// id → base URL ("-2160.mp4", "-1080.mp4" or "-720.mp4" is appended) and what the shot is
const CLIPS = {
  717: [OLD(717), "man from behind, city street"],
  4629: [OLD(4629), "silhouette walking at sunset"],
  4808: [OLD(4808), "silhouette texting at sunset"],
  17450: [OLD(17450), "laptop at night"],
  14669: [OLD(14669), "texting at night"],
  1808: [OLD(1808), "typing on a laptop"],
  4827: [OLD(4827), "hands typing, shirt cuffs"],
  41287: [OLD(41287), "typing on a keyboard, vertical"],
  42662: [OLD(42662), "hands on a laptop keyboard"],
  1781: [OLD(1781), "typing close up"],
  41646: [OLD(41646), "programmer's hands, RGB keyboard"],
  4907: [OLD(4907), "typing in detail"],
  45148: [OLD(45148), "writing notes in a notebook"],
  4915: [OLD(4915), "typing on a phone"],
  144: [OLD(144), "texting by a window"],
  247: [OLD(247), "phone resting on a laptop"],
  99888: [NEW(99888, 1717186447), "taking notes with a pen"],
  99890: [NEW(99890, 1717186770), "writing in a spiral notebook"],
  99909: [NEW(99909, 1717715134), "writing a to-do list"],
  43935: [OLD(43935), "steaming cup of coffee"],
  46058: [OLD(46058), "coffee cup in beans"],
  44956: [OLD(44956), "steaming coffee cup"],
  1730: [OLD(1730), "coffee next to code on a laptop"],
  100253: [NEW(100253, 1722543131), "pouring coffee"],
  100262: [NEW(100262, 1722550550), "pouring coffee into a mug"],
};

// Which shots suit each scene
export const SHOTS = {
  hook: [717, 4629, 4808, 17450, 14669, 41646],
  work: [1808, 4827, 41287, 42662, 1781, 41646, 4907, 45148, 4915, 144, 99888, 99890, 99909],
  coffee: [43935, 46058, 44956, 1730, 100253, 100262],
  cta: [247, 4808, 4629, 17450, 14669],
};

function hash(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

// Biggest file first: a 9:16 crop of 4K landscape stays sharp (1215x2160), of 1080p it doesn't
async function download(id) {
  const file = path.join(CACHE, `mixkit-${id}.mp4`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  for (const size of [2160, 1080, 720]) {
    const res = await fetch(`${CLIPS[id][0]}-${size}.mp4`);
    if (!res.ok || !String(res.headers.get("content-type")).startsWith("video/")) continue;
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(`${file}.part`, Buffer.from(await res.arrayBuffer()));
    fs.renameSync(`${file}.part`, file);
    return file;
  }
  throw new Error(`Mixkit clip ${id} could not be downloaded`);
}

// ffmpeg-static has no ffprobe; ffmpeg prints "Duration: 00:00:12.34" for any input
function duration(ffmpeg, file) {
  return new Promise((resolve) => {
    const p = spawn(ffmpeg, ["-hide_banner", "-i", file], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", () => {
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      resolve(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 10);
    });
  });
}

// kinds: ["hook", "work", "coffee", ...] → one local clip per scene, never the same clip twice in
// a reel. The seed (post ID + variant) picks them, so the same post always gets the same shots.
export async function pickClips(kinds, seed, ffmpeg) {
  const used = new Set();
  const picks = [];
  for (let i = 0; i < kinds.length; i++) {
    const pool = (SHOTS[kinds[i]] || SHOTS.work).filter((id) => !used.has(id));
    const options = pool.length ? pool : SHOTS.work.filter((id) => !used.has(id));
    const id = options[hash(`${seed}|${i}`) % options.length];
    used.add(id);
    const file = await download(id);
    picks.push({ id, file, about: CLIPS[id][1], duration: await duration(ffmpeg, file) });
  }
  return picks;
}
