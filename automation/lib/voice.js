// Reel voiceover: card text → spoken line → Edge neural TTS (free, no key) with word timings.
// REEL_VOICE picks the voice (default en-US-AvaMultilingualNeural, the most conversational free one;
// en-IN-NeerjaExpressiveNeural for an Indian accent), REEL_VOICE_RATE the speed (default +0%).
import fs from "node:fs";
import path from "node:path";
import { EdgeTTS } from "node-edge-tts";

const VOICE = process.env.REEL_VOICE || "en-US-AvaMultilingualNeural";
const RATE = process.env.REEL_VOICE_RATE || "+0%";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const MONTH = /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(\W*)$/i;
const monthName = (abbr) => MONTHS.find((m) => m.toLowerCase().startsWith(abbr.slice(0, 3).toLowerCase()));
const CURRENCY = /^(~?)(rs\.?|₹|inr|us\$|\$)$/i;
const UNIT = /^(lpa|lakhs?|crores?|cr|k)(\W*)$/i;
const UNIT_WORD = { lpa: "lakh per annum", lakh: "lakh", lakhs: "lakh", crore: "crore", crores: "crore", cr: "crore", k: "thousand" };

// One display token → what the voice should say for it ("" = silent)
function speakToken(token) {
  let t = token;
  if (/^@beyond_the\.offer/i.test(t)) return t.replace(/^@beyond_the\.offer/i, "Beyond the Offer");
  if (/beyondtheoffer\.vercel\.app/i.test(t)) return t.replace(/\S*beyondtheoffer\.vercel\.app\S*/i, "beyond the offer dot vercel dot app");
  if (t === "+" || t === "&") return "and";
  if (/^[-–—|·→]+$/.test(t)) return "";
  t = t.replace(/^(\d{4})-(\d{2})-(\d{2})(\W*)$/, (_, y, m, d, p) => `${MONTHS[Number(m) - 1]} ${Number(d)}${p}`);
  t = t.replace(/\bB\.Tech\b/gi, "B Tech").replace(/\bM\.Tech\b/gi, "M Tech");
  // Said the way Indian students say them, not "eye eye tee"
  t = t.replace(/\bIIITs?\b/g, (m) => (m.endsWith("s") ? "triple I Ts" : "triple I T")).replace(/\bIIT(s?)\b/g, "I I T$1").replace(/\bNIT(s?)\b/g, "N I T$1");
  t = t.replace(/^(\d[\d,.]*)[-–](\d[\d,.]*)/, "$1 to $2"); // 10-30, 2024-26
  t = t.replace(/(\d[\d,.]*)[kK]\b/g, "$1 thousand").replace(/(\d[\d,.]*)L\b/g, "$1 lakh");
  t = t.replace(/\/(month|mo)\b/i, " a month").replace(/\/(year|yr)\b/i, " a year");
  const unit = t.match(UNIT);
  if (unit) t = UNIT_WORD[unit[1].toLowerCase()] + unit[2];
  const month = t.match(MONTH);
  // Only capitalised words are months ("you may apply" stays a verb); "Nov." keeps its full stop
  if (month && /^[A-Z]/.test(t)) t = monthName(month[1]) + (month[2] || (t.endsWith(".") ? "." : ""));
  t = t.replace(/^([A-Z]{2,4})(?:\/[A-Z]{2,4})+(\W*)$/, (m) => m.split("/").join(", ")); // CS/IT/ECE
  t = t.replace(/([a-z])\/([A-Za-z])/g, "$1 or $2"); // Bangalore/Hyderabad
  return t.replace(/[()]/g, "").replace(/\p{Extended_Pictographic}/gu, "");
}

// What a card made of fields ("Name | online, free | by 8 Nov") should sound like:
// "Name. Online and free. Register by 8 Nov." instead of each field read as its own clipped line.
export function fluentLine(text, { category = "tech" } = {}) {
  const [name = "", ...rest] = String(text).split(/\s*\|\s*/).map((f) => f.trim()).filter(Boolean);
  const items = [];
  let deadline = "";
  for (const field of rest) {
    for (const part of field.split(/,\s+|\s+[-–]\s+/).map((p) => p.trim()).filter(Boolean)) {
      const by = part.match(/^(?:register\s+|apply\s+)?(?:by|before|till|until)\s+(.+)$/i);
      const last = part.match(/^last\s+date\s*[:\-–]?\s*(.+)$/i);
      if (by) deadline = `${category === "events" ? "Register" : "Apply"} by ${by[1]}`;
      else if (last) deadline = `The last date is ${last[1]}`;
      else items.push(part.replace(/^(.*\d[kKlL]?)\s+(prizes?|prize pool|stipend)\b/i, "$1 in $2"));
    }
  }
  // Short words run together ("Online and free"); anything with a number gets its own sentence
  const groups = [];
  for (const item of items) {
    if (/\d/.test(item) || !groups.length || /\d/.test(groups[groups.length - 1].at(-1))) groups.push([item]);
    else groups[groups.length - 1].push(item);
  }
  const join = (g) => (g.length === 1 ? g[0] : `${g.slice(0, -1).join(", ")} and ${g.at(-1)}`);
  const said = groups.map(join).map((l) => l[0].toUpperCase() + l.slice(1));
  const lines = [name.replace(/\s*\(([^)]+)\)/g, ", $1"), ...said, deadline].filter(Boolean);
  return lines.map((l) => l.replace(/[.!?]*$/, ".")).join(" ");
}

// Splits text into display tokens and a matching spoken line; tokens[i].at is the token's
// character offset inside the spoken line so TTS word timings can be mapped back onto it.
export function narrate(text) {
  // Emoji are dropped (CI has no emoji font) and "->" becomes an arrow the voice skips
  const clean = String(text)
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/\s*->\s*/g, " → ")
    .replace(/\s+\|\s+/g, " · ")
    .replace(/\s+[-–—]\s+/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = [];
  let spoken = "";
  let field = 0;
  const words = clean.split(" ");
  let day = "";
  let currency = "";
  words.forEach((word, i) => {
    if (word === "·") {
      // Field separator: a sentence break for the voice, not shown on screen
      spoken = spoken.replace(/[,.!?;:]?\s*$/, ". ");
      field += 1;
      return;
    }
    const next = words[i + 1] || "";
    let say = speakToken(word);
    // "4 Nov" → "November 4"
    if (/^\d{1,2}$/.test(word) && MONTH.test(next)) { day = word; say = ""; }
    else if (day && MONTH.test(word)) { say = say.replace(/^(\w+)/, `$1 ${day}`); day = ""; }
    // "Rs 50K" / "~Rs 13 LPA" / "US$20,000" → "50 thousand rupees" / "about 13 lakh rupees per annum" / "20,000 dollars"
    const glued = word.match(/^(~?)(rs\.?|₹|us\$|\$)(\d.*)$/i);
    if (glued) { currency = /\$/.test(glued[2]) ? "dollars" : "rupees"; say = (glued[1] ? "about " : "") + speakToken(glued[3]); }
    const sign = word.match(CURRENCY);
    if (sign && /^\d/.test(next)) { currency = /\$/.test(sign[2]) ? "dollars" : "rupees"; say = sign[1] ? "about" : ""; }
    else if (currency && /\d/.test(word) && !UNIT.test(next)) { say = say.replace(/^(.*\d(?: (?:thousand|lakh|crore))?)/, `$1 ${currency}`); currency = ""; }
    else if (currency && UNIT.test(word)) { say = say.replace(/^(lakh|crore|thousand)/, `$1 ${currency}`); currency = ""; }
    tokens.push({ text: word, at: spoken.length, field });
    if (say) spoken += `${say} `;
  });
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
