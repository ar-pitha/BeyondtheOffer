// Background music for job reels: chill hip-hop, lo-fi and R&B tracks from Mixkit (free licence,
// fine for social media, no credit or key). Downloaded once into automation/renders/_broll/music/.
// A different track per post (by its ID), so a regenerated variant can change the song.
// For each track we find where the beat is in (to skip a quiet intro) and the beats themselves,
// so lib/brollReel.js can cut on them.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT } from "./config.js";

const CACHE = path.join(ROOT, "renders", "_broll", "music");

// id → title, all checked as Mixkit Stock Music Free License
export const TRACKS = {
  282: "Sweet September",
  135: "Sleepy Cat",
  763: "Lo-Fi 01",
  764: "Lo-Fi 02",
  766: "Lo-Fi 04",
  485: "Green Chair RnB",
  476: "Baileys",
  257: "Eyes in the Puddle",
  258: "Find Me Outside",
  738: "Hip Hop 02",
  739: "Hip Hop 03",
  970: "Night Sky Hip Hop",
  988: "Day Dreamin' with U",
  224: "RnB",
};

function hash(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

async function download(id) {
  const file = path.join(CACHE, `${id}.mp3`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  const res = await fetch(`https://assets.mixkit.co/music/${id}/${id}.mp3`);
  if (!res.ok) throw new Error(`Mixkit track ${id} could not be downloaded: HTTP ${res.status}`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(`${file}.part`, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(`${file}.part`, file);
  return file;
}

// Loudness every 10 ms from mono 8 kHz PCM
const RATE = 8000;
const HOP = 80;
function envelope(ffmpeg, file) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ["-v", "error", "-i", file, "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"], { stdio: ["ignore", "pipe", "ignore"] });
    const chunks = [];
    p.stdout.on("data", (d) => chunks.push(d));
    p.on("error", reject);
    p.on("close", () => {
      const pcm = Buffer.concat(chunks);
      const n = Math.floor(pcm.length / 2 / HOP);
      const env = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < HOP; j++) {
          const v = pcm.readInt16LE((i * HOP + j) * 2) / 32768;
          sum += v * v;
        }
        env[i] = Math.sqrt(sum / HOP);
      }
      resolve(env);
    });
  });
}

// Start: the first moment the track reaches its normal level (past any intro).
// Beats: peaks in the rise of loudness, at least 0.25 s apart.
function analyse(env) {
  const sorted = [...env].sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length * 0.6)] || 0;
  let start = 0;
  for (let i = 0; i < env.length; i++) {
    const win = env.slice(i, i + 100);
    if (win.length && win.reduce((a, b) => a + b, 0) / win.length >= typical * 0.85) {
      start = i / 100;
      break;
    }
  }
  const flux = Array.from(env, (v, i) => Math.max(0, v - (env[i - 1] || 0)));
  const fluxSorted = [...flux].sort((a, b) => a - b);
  const strong = fluxSorted[Math.floor(fluxSorted.length * 0.9)] || 0;
  const beats = [];
  for (let i = 2; i < flux.length - 2; i++) {
    if (flux[i] >= strong && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1] && flux[i] >= flux[i - 2] && flux[i] >= flux[i + 2]) {
      const t = i / 100;
      if (!beats.length || t - beats[beats.length - 1] >= 0.25) beats.push(t);
    }
  }
  return { start, beats };
}

// One track per post (the seed), with where to start it and its beats relative to that start
export async function pickMusic(seed, ffmpeg) {
  const ids = Object.keys(TRACKS);
  const id = ids[hash(seed) % ids.length];
  const file = await download(id);
  const meta = path.join(CACHE, `${id}.json`);
  let info;
  if (fs.existsSync(meta)) info = JSON.parse(fs.readFileSync(meta, "utf8"));
  else {
    info = analyse(await envelope(ffmpeg, file));
    fs.writeFileSync(meta, JSON.stringify(info));
  }
  return {
    file,
    title: `${TRACKS[id]} (mixkit ${id})`,
    start: info.start,
    beats: info.beats.filter((b) => b >= info.start).map((b) => b - info.start),
  };
}
