// Content_Queue row → clean white carousel (templates/post.html), rendered at 1440x1800.
//   cover (hook + every company's logo) → one card per opening → profile card ("Comment JOB", follow)
// Cards come from the sheet rows in Item_IDs, so each company gets its own card with its own logo
// and only the facts that matter. Without sheet rows the draft's lines are used, one per card.
// Every format (Carousel, and old Reel/Story drafts) is posted this way.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, TABS } from "./config.js";
import { parseSlides, parseReelScript, getBrowser } from "./render.js";
import { logoFor, slugify, knownIn } from "./logos.js";
import { parseSheetDate } from "./mapping.js";

const TEMPLATE = path.join(ROOT, "templates", "post.html");
const PROFILE_PIC = path.join(ROOT, "assets", "profile.jpg");
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, "templates", "brand.json"), "utf8"));
const MAX_SLIDES = 20;
// Instagram keeps portrait posts up to 1440 px wide; rendering at that size keeps text sharp
const SCALE = 1440 / 1080;

const LOOK = {
  tech: { accent: "#2f54eb", kicker: "Jobs for freshers" },
  govt: { accent: "#c2410c", kicker: "Government jobs" },
  events: { accent: "#0f7a55", kicker: "Hackathons for students" },
  news: { accent: "#2f54eb", kicker: "Tech news" },
  ai: { accent: "#6d3fd6", kicker: "AI news" },
};
// Comment keywords the auto-reply understands (frontend/api/_lib/replies.js)
const KEYWORD = { tech: "JOB", govt: "JOB", events: "LINK", news: "LINK", ai: "LINK" };

// Placeholders the research task writes when a fact is missing; a card leaves those rows out
const EMPTY = /^(-|n\/?a|na|tbd|tba|nil|none|various|varies|multiple)$|not (stated|posted|disclosed|mentioned|specified|available|declared|given|known)|see (the )?(official )?notification|no deadline|^post[- ]?wise|^as per\b|^varies\b|^depends\b/i;
const URL = /https?:\/\/|www\./i;

// Job/requisition numbers, advert codes and source notes mean nothing to a student
const tidy = (value) =>
  String(value ?? "")
    .replace(/\s*\((?:(?:req|jreq|job|ref|id)\s*[#:.-]?\s*\d|(?:requisition|notification|advt|official|per|source|as per)\b)[^)]*\)/gi, "")
    .replace(/,?\s*\b(?:advt\.?|advertisement|post code|notification|job id|req(?:uisition)?)\s*(?:no\.?)?\s*[\w./-]*\d[\w./-]*/gi, "")
    .replace(/[;,]?\s*see (the )?(official )?notification\.?/gi, "")
    .replace(/[;,]?\s*(?:aggregators?|some sites?|unofficial sources?)\s+(?:lists?|says?|mentions?)[^;]*/gi, "")
    .replace(/\bRs\.?\s*/g, "₹")
    .replace(/^(\d{4,})$/, (n) => Number(n).toLocaleString("en-IN"))
    .replace(/\s+/g, " ")
    .replace(/[\s,;:-]+$/, "")
    .trim();

// Brackets read as clutter on a card: "(Gr B)" and "(BEL)" go, "(or PG 45%)" becomes ", or PG 45%"
const unbracket = (s) =>
  s
    .replace(/\s*\(([^()]*)\)/g, (_, inner) => (/\d/.test(inner) && !/^\s*(gr|group|cen|advt|no)\b/i.test(inner) ? `, ${inner.trim()}` : ""))
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .trim();

function clean(value, max = 90) {
  const s = unbracket(tidy(value));
  if (!s || EMPTY.test(s) || URL.test(s)) return "";
  if (s.length <= max) return s;
  // Cut at a natural break rather than mid-word
  const cut = s.slice(0, max);
  const at = Math.max(cut.lastIndexOf(";"), cut.lastIndexOf(","), cut.lastIndexOf(" ("), cut.lastIndexOf(". "));
  return (at > 40 ? cut.slice(0, at) : cut.replace(/\s+\S*$/, "")).trim();
}

// "2026-11-12", "12/11/2026", "12 Nov 2026" → "12 Nov 2026"; anything else (e.g. "Rolling") is dropped
function prettyDate(value) {
  const date = parseSheetDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

// Names and titles drop every bracket, even ones with numbers: "(Electronics 200, Mechanical 150)"
const heading = (value, max) => clean(String(value ?? "").replace(/\s*\([^)]*\)/g, ""), max);

const row = (label, value, max) => {
  const v = clean(value, max);
  return v ? { label, value: v } : null;
};

// One sheet row → one card
function cardFromItem(item) {
  const id = String(item.ID || "").toUpperCase();
  const link = item.Apply_Link || item.Official_Link || item.Notification_Link || item.Link || "";
  if (id.startsWith("GJ-")) {
    return {
      type: "item",
      company: heading(item.Organisation, 60),
      title: heading(item.Post_Exam, 110),
      rows: [
        row("Posts", item.Vacancies, 40),
        row("Qualification", item.Qualification),
        row("Age limit", item.Age_Limit, 50),
        prettyDate(item.Last_Date) && { label: "Last date", value: prettyDate(item.Last_Date) },
      ].filter(Boolean),
      lookup: { name: tidy(item.Organisation), link },
    };
  }
  if (id.startsWith("HQ-")) {
    return {
      type: "item",
      company: heading(item.Organiser, 60),
      title: heading(item.Name, 110),
      rows: [
        row("Eligibility", item.Eligibility),
        row("Prizes", item.Prizes_Perks),
        prettyDate(item.Event_Date) && { label: "Event date", value: prettyDate(item.Event_Date) },
        prettyDate(item.Register_By) && { label: "Register by", value: prettyDate(item.Register_By) },
      ].filter(Boolean),
      lookup: { name: tidy(item.Organiser), link },
    };
  }
  if (id.startsWith("TN-")) {
    // The headline names the company the story is about; the summary often mentions partners too
    const company = knownIn(item.Headline) || knownIn(item.Summary);
    return {
      type: "news",
      company: company || clean(item.Source, 40),
      title: heading(item.Headline, 120),
      body: clean(item.Summary, 260),
      lookup: company ? { name: company } : null,
    };
  }
  return {
    type: "item",
    company: heading(item.Company, 60),
    title: heading(item.Role, 110),
    rows: [
      row("Eligibility", item.Eligibility_Batch),
      row("Location", item.Location, 70),
      row(/intern/i.test(`${item.Role} ${item.Job_Type}`) ? "Stipend" : "Salary", item.Salary_Stipend, 60),
      prettyDate(item.Apply_By) && { label: "Apply by", value: prettyDate(item.Apply_By) },
    ].filter(Boolean),
    lookup: { name: tidy(item.Company), link },
  };
}

// ---- drafts without sheet rows ----

const DEADLINE = /\b(apply (by|before)|register (by|before)|last date|deadline|closes?)\b/i;
const SKIP_FIELD = /^(verified|logo)\s*[:\-–]/i;

// "Slide N:" lines, reel drafts (HOOK/POINT/CTA), or plain lines (one card each)
function slidesFromScript(script) {
  const text = String(script || "");
  if (/^\s*(hook|point|cta)\b[^:\n]*:/im.test(text)) {
    return parseReelScript(text).map((c) => ({
      variant: c.kind === "hook" ? "cover" : c.kind === "cta" ? "cta" : "item",
      fields: c.kind === "point" ? c.text.split("|").map((f) => f.trim()).filter(Boolean) : c.fields,
    }));
  }
  if (/^\s*(slide|frame)\s*\d/im.test(text)) return parseSlides(text);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line, i) => ({
    variant: i === 0 ? "cover" : i === lines.length - 1 && !line.includes("|") ? "cta" : "item",
    fields: line.split("|").map((f) => f.trim()).filter(Boolean),
  }));
}

function cardFromFields(fields) {
  const kept = fields.filter((f) => !SKIP_FIELD.test(f) && !EMPTY.test(f) && !URL.test(f));
  const deadline = kept.find((f) => DEADLINE.test(f));
  const rest = kept.filter((f) => f !== deadline);
  // "Company | Role | ..." is the draft shape; otherwise look for a known company name
  const company = rest.length > 1 && rest[0].split(/\s+/).length <= 4 && !/\d{3,}/.test(rest[0]) ? rest.shift() : knownIn(kept.join(" "));
  if (!company && rest.length === 1) return { type: "statement", text: rest[0] };
  const date = deadline && prettyDate(deadline.replace(/^.*?(by|before|date)\s*:?\s*/i, ""));
  return {
    type: "item",
    company,
    title: rest.shift() || "",
    rows: [
      ...rest.slice(0, 3).map((value) => ({ label: "", value: clean(value) })).filter((r) => r.value),
      date && { label: /register/i.test(deadline) ? "Register by" : /last date/i.test(deadline) ? "Last date" : "Apply by", value: date },
    ].filter(Boolean),
    lookup: company ? { name: company } : null,
  };
}

// ---- deck ----

// Still open: not marked expired, and its last date (if any) hasn't passed
function isOpen(item) {
  if (/expired|closed/i.test(item.Status || "")) return false;
  const date = parseSheetDate(item.Last_Date || item.Apply_By || item.Register_By || "");
  return !date || Number.isNaN(date.getTime()) || date.getTime() > Date.now();
}

export async function loadItems(itemIds) {
  const ids = String(itemIds || "").split(/[,\s]+/).filter(Boolean);
  if (!ids.length) return [];
  const { readTab } = await import("./sheets.js");
  const found = [];
  for (const tab of [TABS.tech, TABS.govt, TABS.events, TABS.news]) {
    const { rows } = await readTab(tab).catch(() => ({ rows: [] }));
    for (const r of rows) if (ids.includes(r.ID)) found.push(r);
  }
  return ids.map((id) => found.find((r) => r.ID === id)).filter(Boolean);
}

// Pure: row (+ sheet items) → slide models, logos not resolved yet
export function planDeck(row, category, items = []) {
  const look = LOOK[category] || LOOK.tech;
  const keyword = KEYWORD[category] || "LINK";
  const isNews = category === "news" || category === "ai";
  const slides = slidesFromScript(row.Slides_or_Script);
  const cover = slides[0]?.variant === "cover" ? slides[0].fields : [row.Title];
  const wanted = String(row.Item_IDs || "").split(/[,\s]+/).filter(Boolean);

  // Sheet rows when every item resolved; the draft's own lines otherwise
  const cards =
    items.length && items.length === wanted.length
      ? items.map(cardFromItem)
      : slides.filter((s) => s.variant === "item").map((s) => cardFromFields(s.fields));

  const [hook, sub] = cover;
  const deck = [
    {
      type: "cover",
      hook: hook || row.Title || "Openings this week",
      sub: clean(String(sub || "").replace(/,?\s*no (closing date|deadline)[^,]*/i, ""), 110),
      kicker: look.kicker,
      logos: cards.filter((c) => c.lookup).slice(0, 6).map((c) => c.lookup),
    },
    ...cards,
    {
      type: "profile",
      keyword,
      line: isNews ? "Daily tech news for students, in plain words." : "Verified openings for freshers, every day.",
      ask: isNews ? `Comment ${keyword} for the sources` : `Comment ${keyword} and we'll DM you every apply link`,
    },
  ];
  return deck.slice(0, MAX_SLIDES).map((slide, i, all) => ({ slide, index: i + 1, total: all.length, accent: look.accent }));
}

async function profilePicture() {
  // Fresh from Instagram when the token is around (publish runs); the committed copy otherwise
  if (process.env.IG_ACCESS_TOKEN) {
    try {
      const ig = await import("./instagram.js");
      const { profile_picture_url: url } = await ig.igRequest(ig.igUserId(), { params: { fields: "profile_picture_url" } });
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    } catch {
      // fall through to the committed copy
    }
  }
  return fs.existsSync(PROFILE_PIC) ? `data:image/jpeg;base64,${fs.readFileSync(PROFILE_PIC).toString("base64")}` : null;
}

async function attachImages(deck) {
  const cache = new Map();
  const get = (lookup) => {
    if (!lookup?.name && !lookup?.domain) return null;
    const key = slugify(lookup.name || lookup.domain);
    if (!cache.has(key)) cache.set(key, logoFor(lookup).catch(() => null));
    return cache.get(key);
  };
  for (const { slide } of deck) {
    if (slide.type === "item" || slide.type === "news") slide.logo = await get(slide.lookup);
    if (slide.type === "cover") slide.logos = [...new Set((await Promise.all(slide.logos.map(get))).filter(Boolean))];
    if (slide.type === "profile") slide.picture = await profilePicture();
  }
}

// Renders every slide to a 1440x1800 JPEG in outDir and returns the file paths
export async function renderPost(row, outDir, { category = "tech", items } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  // Openings that closed since the draft was written are left out, unless every one has
  const found = items ?? (await loadItems(row.Item_IDs).catch(() => []));
  const open = found.filter(isOpen);
  const keep = open.length ? open : found;
  if (keep.length < found.length) row = { ...row, Item_IDs: keep.map((i) => i.ID).join(", ") };
  const deck = planDeck(row, category, keep);
  await attachImages(deck);
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: SCALE });
  await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: "networkidle" }).catch(() => page.goto(pathToFileURL(TEMPLATE).href));
  const files = [];
  for (const d of deck) {
    await page.evaluate((data) => window.renderSlide(data), { ...d, handle: brand.handle });
    const file = path.join(outDir, `slide-${String(d.index).padStart(2, "0")}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 100, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
    files.push(file);
  }
  await page.close();
  return files;
}
