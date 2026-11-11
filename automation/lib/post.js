// Content_Queue row → white carousel slides with real company logos (templates/post.html).
// Every format (Carousel, and old Reel/Story drafts) is posted as a carousel:
//   cover (hook + the logos in the post) → one slide per opening → recap list → "Comment JOB".
// Slides without a company (a stake or a tip) render as a plain statement.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, TABS } from "./config.js";
import { parseSlides, parseReelScript, getBrowser } from "./render.js";
import { logoFor, slugify, knownIn } from "./logos.js";

const TEMPLATE = path.join(ROOT, "templates", "post.html");
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, "templates", "brand.json"), "utf8"));
const MAX_SLIDES = 20;

const LOOK = {
  tech: { accent: "#4f46e5", tint: "#eef0ff", kicker: "Jobs for freshers" },
  govt: { accent: "#c2410c", tint: "#fff1e8", kicker: "Government jobs" },
  events: { accent: "#047857", tint: "#e7f7ef", kicker: "Hackathons for students" },
  news: { accent: "#1d4ed8", tint: "#e9f0ff", kicker: "Tech news" },
  ai: { accent: "#7c3aed", tint: "#f3edff", kicker: "AI news" },
};
// Comment keywords the auto-reply understands (frontend/api/_lib/replies.js)
const KEYWORD = { tech: "JOB", govt: "JOB", events: "LINK", news: "LINK", ai: "LINK" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-11-12" or "12/11/2026" anywhere in the text → "12 Nov"
const prettyDates = (text) =>
  String(text)
    .replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (_, y, m, d) => `${Number(d)} ${MONTHS[m - 1] || m}`)
    .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_, d, m) => `${Number(d)} ${MONTHS[m - 1] || m}`);

const DEADLINE = /\b(apply (by|before)|register (by|before)|registration closes|last date|deadline|closes?|ends? on|due)\b/i;
const VERIFIED = /^verified\s*[:\-–]\s*(.+)$/i;
const LOGO_HINT = /^logo\s*[:\-–]\s*(\S+)$/i;
const URL = /https?:\/\/|www\./i;

// Reel drafts (HOOK / POINT / CTA) read the same as slides once split into fields
function slidesFromScript(script) {
  if (/^\s*(hook|point|cta)\b[^:\n]*:/im.test(script)) {
    return parseReelScript(script).map((c) => ({
      variant: c.kind === "hook" ? "cover" : c.kind === "cta" ? "cta" : "item",
      fields: c.kind === "point" ? c.text.split("|").map((f) => f.trim()).filter(Boolean) : c.fields,
    }));
  }
  return parseSlides(script);
}

// Sheet rows behind the post, so slides get the exact company name and apply link
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

const itemName = (r) => r.Company || r.Organisation || r.Organiser || "";
const itemLink = (r) => r.Apply_Link || r.Official_Link || r.Notification_Link || r.Link || "";

// "Software Engineer Intern, Razorpay" / "Razorpay | SDE Intern" / "Razorpay: SDE Intern"
function splitCompany(fields, items) {
  const text = fields.join(" ").toLowerCase();
  const mentions = (value) => value && text.includes(String(value).toLowerCase());
  const item =
    items.find((r) => mentions(itemName(r))) || items.find((r) => mentions(r.Role) || mentions(r.Post_Exam) || mentions(r.Name));
  let company = item ? itemName(item) : null;
  let rest = [...fields];
  if (!company) {
    const head = rest[0] || "";
    // Only short heads: in a news sentence the text after a comma isn't a company
    const short = head.split(/\s+/).length <= 8;
    const looksLikeName = (t) => /^[A-Z0-9&]/.test(t) && t.split(/\s+/).length <= 4;
    const m = short && (head.match(/^(.+?),\s*([^,]{2,40})$/) || head.match(/^([^:]{2,40}):\s*(.+)$/));
    if (m && head.includes(",") && looksLikeName(m[2].trim())) company = m[2].trim();
    else if (m && !head.includes(",") && looksLikeName(m[1].trim())) company = m[1].trim();
    else company = knownIn(fields.join(" | "));
    // A short first field followed by a role is the company ("Razorpay | SDE Intern")
    if (!company && rest.length > 2 && head.split(/\s+/).length <= 3 && !/\d/.test(head)) company = head;
  }
  if (company) {
    // Only where the name is set off by punctuation, so "SSC CGL 2026" keeps its "SSC"
    const name = company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^\\s*${name}\\s*(?:[:,|\\-–]\\s*|$)|\\s*(?:,|\\s[-–@]|\\sat)\\s*${name}\\s*$`, "i");
    rest = rest.map((f) => f.replace(re, "").trim()).filter(Boolean);
    // "Razorpay SDE Intern" → "SDE Intern" when what's left is a role
    const lead = new RegExp(`^${name}\\s+(?=.*\\b(intern|engineer|developer|analyst|trainee|sde|associate|manager|designer|scientist|consultant|executive|apprentice|officer)\\b)`, "i");
    if (rest[0]) rest[0] = rest[0].replace(lead, "");
  }
  return { company, item, rest };
}

function itemSlide(fields, items, keyword) {
  let deadline = "";
  let verified = "";
  let hint = null;
  const kept = [];
  for (const raw of fields) {
    const f = raw.trim();
    if (!f || URL.test(f)) continue;
    const v = f.match(VERIFIED);
    if (v) {
      verified = /official/i.test(v[1]) ? "Official" : /multi/i.test(v[1]) ? "Verified" : "";
      continue;
    }
    const l = f.match(LOGO_HINT);
    if (l) {
      hint = l[1];
      continue;
    }
    if (!deadline && (DEADLINE.test(f) || /^\d{4}-\d{2}-\d{2}$/.test(f))) {
      deadline = prettyDates(/^\d{4}-/.test(f) ? `Apply by ${f}` : f).replace(/^\w/, (c) => c.toUpperCase());
      continue;
    }
    kept.push(prettyDates(f));
  }
  const { company, item, rest } = splitCompany(kept, items);
  if (!company && !deadline) return { type: "statement", text: rest[0] || "", more: rest.slice(1).join(" · ") };
  return {
    type: "item",
    company,
    lookup: { name: company, domain: hint, link: item ? itemLink(item) : "" },
    title: rest[0] || (item && (item.Role || item.Post_Exam || item.Name)) || "",
    facts: rest.slice(1, 5),
    deadline,
    verified,
    keyword,
  };
}

// Pure: row (+ sheet items) → slide models, logos not resolved yet
export function planDeck(row, category, items = []) {
  const look = LOOK[category] || LOOK.tech;
  const keyword = KEYWORD[category] || "LINK";
  const parsed = slidesFromScript(row.Slides_or_Script || "");
  const deck = [];
  let cta = null;

  parsed.forEach((s, i) => {
    if (i === 0 && s.variant === "cover") {
      const [hook, sub, kicker] = s.fields;
      deck.push({ type: "cover", hook: hook || row.Title, sub: sub || "", kicker: kicker && kicker.length < 32 ? kicker : look.kicker, logos: [] });
    } else if (s.variant === "cta") {
      cta = s.fields;
    } else {
      deck.push(itemSlide(s.fields, items, keyword));
    }
  });
  if (deck[0]?.type !== "cover") deck.unshift({ type: "cover", hook: row.Title || "Openings this week", sub: "", kicker: look.kicker, logos: [] });

  const openings = deck.filter((s) => s.type === "item");
  deck[0].logos = openings.filter((s) => s.company).slice(0, 5).map((s) => s.lookup);
  // The screenshot slide: every opening and its date on one card
  const isNews = category === "news" || category === "ai";
  if (openings.length >= 2 && !isNews) {
    deck.push({
      type: "recap",
      keyword,
      heading: openings.some((s) => s.deadline) ? `All ${openings.length}, with deadlines` : `All ${openings.length} in one place`,
      more: Math.max(0, openings.length - 6),
      rows: openings.slice(0, 6).map((s) => ({ company: s.company, title: s.title, when: s.deadline.replace(/^(apply|register)\s+by\s+|^last date\s*:?\s*/i, ""), lookup: s.lookup })),
    });
  }
  const ctaLine = (cta || []).find((f) => !/comment|follow|links? in bio|\bdm\b/i.test(f));
  deck.push({
    type: "cta",
    keyword,
    then: isNews ? "We'll DM you the sources." : "We'll DM you every apply link.",
    steps: isNews
      ? [ctaLine || "Save this for later", "Send it to a friend who codes", `Follow ${brand.handle} for daily tech news`]
      : [ctaLine || "Save this before the deadlines", "Send it to your batch group", `Follow ${brand.handle} for new openings daily`],
  });
  return deck.slice(0, MAX_SLIDES).map((slide, i, all) => ({ slide, index: i + 1, total: all.length, accent: look.accent, tint: look.tint }));
}

async function attachLogos(deck) {
  const cache = new Map();
  const get = (lookup) => {
    if (!lookup?.name && !lookup?.domain) return null;
    const key = slugify(lookup.name || lookup.domain);
    if (!cache.has(key)) cache.set(key, logoFor(lookup).catch(() => null));
    return cache.get(key);
  };
  for (const { slide } of deck) {
    if (slide.type === "item") slide.logo = await get(slide.lookup);
    if (slide.type === "cover") slide.logos = await Promise.all(slide.logos.map(async (l) => ({ name: l.name, logo: await get(l) })));
    if (slide.type === "recap") for (const r of slide.rows) r.logo = await get(r.lookup);
  }
}

// Renders every slide to a 1080x1350 JPEG in outDir and returns the file paths
export async function renderPost(row, outDir, { category = "tech", items } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const deck = planDeck(row, category, items ?? (await loadItems(row.Item_IDs).catch(() => [])));
  await attachLogos(deck);
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: "networkidle" }).catch(() => page.goto(pathToFileURL(TEMPLATE).href));
  const files = [];
  for (const d of deck) {
    await page.evaluate((data) => window.renderSlide(data), { ...d, handle: brand.handle, website: brand.website });
    const file = path.join(outDir, `slide-${String(d.index).padStart(2, "0")}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 93, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
    files.push(file);
  }
  await page.close();
  return files;
}
