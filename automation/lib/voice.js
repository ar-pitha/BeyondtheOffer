// Reel voiceover: card text → spoken line → Edge neural TTS (free, no key) with word timings.
// REEL_VOICE picks the voice (default en-US-AvaMultilingualNeural, the most conversational free one;
// en-IN-NeerjaExpressiveNeural for an Indian accent), REEL_VOICE_RATE the speed (default +0%).
import fs from "node:fs";
import path from "node:path";
import { EdgeTTS } from "node-edge-tts";

const VOICE = process.env.REEL_VOICE || "en-US-AvaMultilingualNeural";
const RATE = process.env.REEL_VOICE_RATE || "+0%";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// One display token → what the voice should say for it ("" = silent)
function speakToken(token) {
  let t = token;
  if (/^@beyond_the\.offer/i.test(t)) return t.replace(/^@beyond_the\.offer/i, "Beyond the Offer");
  if (/beyondtheoffer\.vercel\.app/i.test(t)) return t.replace(/\S*beyondtheoffer\.vercel\.app\S*/i, "beyond the offer dot vercel dot app");
  if (t === "+" || t === "&") return "and";
  if (/^[-–—|·→]+$/.test(t)) return "";
  t = t.replace(/^(\d{4})-(\d{2})-(\d{2})(\W*)$/, (_, y, m, d, p) => `${MONTHS[Number(m) - 1]} ${Number(d)}${p}`);
  t = t.replace(/\bB\.Tech\b/gi, "B Tech").replace(/\bM\.Tech\b/gi, "M Tech");
  return t.replace(/\p{Extended_Pictographic}/gu, "");
}

// Splits text into display tokens and a matching spoken line; tokens[i].at is the token's
// character offset inside the spoken line so TTS word timings can be mapped back onto it.
export function narrate(text) {
  const clean = String(text).replace(/\s+\|\s+/g, " · ").replace(/\s+[-–—]\s+/g, ", ").replace(/\s+/g, " ").trim();
  const tokens = [];
  let spoken = "";
  let field = 0;
  for (const word of clean.split(" ")) {
    if (word === "·") {
      // Field separator: a sentence break for the voice, not shown on screen
      spoken = spoken.replace(/[,.!?;:]?\s*$/, ". ");
      field += 1;
      continue;
    }
    const say = speakToken(word);
    tokens.push({ text: word, at: spoken.length, field });
    if (say) spoken += `${say} `;
  }
  return { tokens, spoken: spoken.trim() };
}

// Assigns each display token a start time (seconds) from the TTS word boundaries.
function timeTokens(tokens, spoken, parts) {
  const lower = spoken.toLowerCase();
  const marks = [];
  let cursor = 0;
  for (const p of parts) {
    const word = String(p.part).trim().toLowerCase();
    if (!word) continue;
    const at = lower.indexOf(word, cursor);
    if (at < 0) continue;
    marks.push({ at, start: p.start / 1000, end: p.end / 1000 });
    cursor = at + word.length;
  }
  let m = 0;
  return tokens.map((t) => {
    while (m + 1 < marks.length && marks[m + 1].at <= t.at) m++;
    const mark = marks[m] || { start: 0, end: 0 };
    return { ...t, start: mark.start, end: mark.end };
  });
}

// Spreads tokens evenly when there is no voice (TTS unavailable).
export function evenTiming(tokens, seconds) {
  const step = seconds / Math.max(1, tokens.length);
  return tokens.map((t, i) => ({ ...t, start: +(i * step).toFixed(3), end: +((i + 1) * step).toFixed(3) }));
}

// Duration of an audio file from ffmpeg's banner ("Duration: 00:00:03.62").
export async function probeSeconds(ffmpeg, file) {
  const { spawnSync } = await import("node:child_process");
  const out = spawnSync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf8" }).stderr || "";
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

// Speaks one line to outFile (mp3); retries because the free endpoint drops connections.
// prefix is said but not shown ("First up,"), so the voice sounds like talking, not reading cards.
export async function speak(text, outFile, { ffmpeg, rate = RATE, attempts = 4, prefix = "" } = {}) {
  const said = narrate(text);
  const lead = prefix ? `${prefix} ` : "";
  const spoken = lead + said.spoken;
  const tokens = said.tokens.map((t) => ({ ...t, at: t.at + lead.length }));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const tts = new EdgeTTS({
        voice: VOICE,
        lang: VOICE.slice(0, 5),
        outputFormat: "audio-24khz-96kbitrate-mono-mp3",
        saveSubtitles: true,
        rate,
        timeout: 30_000,
      });
      await tts.ttsPromise(spoken, outFile);
      const parts = JSON.parse(fs.readFileSync(`${outFile}.json`, "utf8"));
      const seconds = await probeSeconds(ffmpeg, outFile);
      if (!seconds) throw new Error("TTS returned empty audio");
      return { file: outFile, seconds, spoken, tokens: timeTokens(tokens, spoken, parts) };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw new Error(`voiceover failed after ${attempts} tries: ${lastError?.message || lastError}`);
}
