// Synthesised cinematic bed for reels: warm pad chords, sub drone, a soft pulse, a low impact on
// every cut and a whoosh riser into it. Generated per reel so it always fits the edit and has no
// licensing questions. Writes 16-bit stereo WAV.
import fs from "node:fs";

const SR = 44100;
const TAU = Math.PI * 2;
// One progression and tempo per reel theme, voiced low and wide (MIDI notes)
const MOODS = {
  // Am → F → C → G: wide, cinematic
  cinematic: { bpm: 96, pulse: 1, chords: [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [48, 55, 60, 64, 67], [43, 50, 55, 59, 62]] },
  // Dm → B♭ → F → C: darker and faster, for the terminal look
  terminal: { bpm: 112, pulse: 1.3, chords: [[38, 45, 50, 53, 57], [34, 46, 50, 53, 58], [41, 48, 53, 57, 60], [36, 48, 52, 55, 60]] },
  // C → Am → F → G: warm, lo-fi, for the notes look
  notes: { bpm: 82, pulse: 0.6, chords: [[36, 48, 52, 55, 64], [33, 45, 52, 57, 60], [41, 48, 53, 57, 65], [43, 50, 55, 59, 62]] },
  // F → G → Em → Am: bright and techy
  browser: { bpm: 100, pulse: 1, chords: [[41, 48, 53, 57, 64], [43, 50, 55, 59, 62], [40, 47, 52, 55, 59], [45, 52, 57, 60, 64]] },
  // Em → C → G → D: urgent, for the news look
  news: { bpm: 120, pulse: 1.4, chords: [[40, 47, 52, 55, 59], [36, 48, 52, 55, 60], [43, 50, 55, 59, 62], [38, 45, 50, 54, 57]] },
};
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Deterministic noise so the same reel always sounds the same
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
}

// variant starts the progression on a different chord and nudges the tempo
export function writeScore(file, { seconds, cuts = [], mood = "cinematic", variant = 0 }) {
  const base = MOODS[mood] || MOODS.cinematic;
  const shift = Math.abs(variant | 0) % base.chords.length;
  const CHORDS = [...base.chords.slice(shift), ...base.chords.slice(0, shift)];
  const bpm = base.bpm + ((Math.abs(variant | 0) % 3) - 1) * 4;
  const { pulse } = base;
  const n = Math.ceil(seconds * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const noise = rng(7);
  const chordLen = (60 / bpm) * 8; // two bars per chord

  // Pad: detuned triangle-ish voices through a slowly opening low-pass
  let lpL = 0, lpR = 0;
  const phases = CHORDS.map((c) => c.map((_, k) => [k * 1.7, k * 2.3]));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const pos = t / chordLen;
    const ci = Math.floor(pos) % CHORDS.length;
    const next = (ci + 1) % CHORDS.length;
    const frac = pos - Math.floor(pos);
    const xf = frac > 0.85 ? (frac - 0.85) / 0.15 : 0; // crossfade into the next chord
    let sl = 0, sr = 0;
    for (const [idx, w] of [[ci, 1 - xf], [next, xf]]) {
      if (w <= 0) continue;
      CHORDS[idx].forEach((note, k) => {
        const f = hz(note);
        const ph = phases[idx][k];
        ph[0] += (TAU * f * 0.997) / SR;
        ph[1] += (TAU * f * 1.003) / SR;
        const amp = (k === 0 ? 0.5 : 0.28) * w;
        sl += (Math.sin(ph[0]) + 0.3 * Math.sin(3 * ph[0]) / 3) * amp;
        sr += (Math.sin(ph[1]) + 0.3 * Math.sin(3 * ph[1]) / 3) * amp;
      });
    }
    const cutoff = 0.02 + 0.05 * (0.5 + 0.5 * Math.sin(TAU * t / 11)) + Math.min(0.04, t / 300);
    lpL += cutoff * (sl - lpL);
    lpR += cutoff * (sr - lpR);
    const swell = Math.min(1, t / 2.5);
    L[i] += lpL * 0.32 * swell;
    R[i] += lpR * 0.32 * swell;

    // Sub drone on the chord root
    const sub = Math.sin(TAU * hz(CHORDS[ci][0] - 12) * t) * 0.16 * swell * (1 - xf) +
      Math.sin(TAU * hz(CHORDS[next][0] - 12) * t) * 0.16 * swell * xf;
    L[i] += sub;
    R[i] += sub;
  }

  // Pulse: soft muted ticks on eighth notes after the hook, for momentum
  const beat = 60 / bpm / 2;
  const startPulse = cuts[1] ?? 3;
  for (let b = startPulse; b < seconds - 1.5; b += beat) {
    const at = Math.floor(b * SR);
    const accent = Math.round((b - startPulse) / beat) % 2 === 0 ? 1 : 0.55;
    let hp = 0, prev = 0;
    for (let j = 0; j < SR * 0.06 && at + j < n; j++) {
      const x = noise();
      hp = 0.9 * (hp + x - prev);
      prev = x;
      const v = hp * Math.exp(-j / (SR * 0.012)) * 0.05 * accent * pulse;
      L[at + j] += v * 0.8;
      R[at + j] += v;
    }
  }

  // Impact on every cut, whoosh riser into it
  for (const cut of cuts) {
    const at = Math.floor(cut * SR);
    for (let j = 0; j < SR * 1.6 && at + j < n; j++) {
      const t = j / SR;
      const f = 38 + 70 * Math.exp(-t * 9);
      const body = Math.sin(TAU * f * t) * Math.exp(-t * 2.6) * 0.55;
      const click = noise() * Math.exp(-t * 60) * 0.25;
      L[at + j] += body + click;
      R[at + j] += body + click;
    }
    const len = Math.floor(SR * 0.7);
    let bp1 = 0, bp2 = 0;
    for (let j = 0; j < len; j++) {
      const i = at - len + j;
      if (i < 0) continue;
      const p = j / len;
      const f = 0.02 + 0.25 * p * p;
      const x = noise();
      bp1 += f * (x - bp1);
      bp2 += f * (bp1 - bp2);
      const v = (bp1 - bp2) * p * p * 0.9;
      L[i] += v * (1 - p * 0.5);
      R[i] += v * (0.5 + p * 0.5);
    }
  }

  // Fade out and soft clip
  const fade = Math.floor(SR * 2);
  const buf = Buffer.alloc(44 + n * 4);
  for (let i = 0; i < n; i++) {
    const g = i > n - fade ? (n - i) / fade : 1;
    buf.writeInt16LE(Math.round(Math.tanh(L[i] * g) * 32000), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.tanh(R[i] * g) * 32000), 46 + i * 4);
  }
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  fs.writeFileSync(file, buf);
  return file;
}
