// Approved Content_Queue rows → Instagram.
//   node publish.js              publish one due row (only inside POST_SLOTS_IST unless scheduled)
//   node publish.js --dry-run    render + upload, no publish; ignores time slots
//   node publish.js --sample     use fixtures/content-queue.sample.json instead of the sheet
//   node publish.js --now        ignore posting slots
//   node publish.js --id CQ-12   pick a specific row
//   node publish.js --check      only report whether anything is due (used by the workflow)
//
// One row per run. Failures keep Status=Approved and are written to Run_Log;
// after 3 failed runs a row is skipped until someone fixes it.

import fs from "node:fs";
import path from "node:path";
import { ROOT, TABS, WEBSITE_URL, hasFlag, isDryRun } from "./lib/config.js";
import { readTab, updateRow, nowInZone, logRun } from "./lib/sheets.js";
import { parseSlides, closeBrowser } from "./lib/render.js";
import { hasCloudinary, uploadSlides, uploadVideo } from "./lib/cloudinary.js";
import { categoryForRow } from "./lib/category.js";

const dryRun = isDryRun();
const sample = hasFlag("sample");
const checkOnly = hasFlag("check");
const argv = process.argv.slice(2);
// --dry-run (CLI) and --now publish outside the posting slots; DRY_RUN=true alone keeps the slots,
// so scheduled dry runs behave like real ones.
const ignoreSlots = hasFlag("dry-run") || hasFlag("now");
const forcedId = argv.includes("--id") ? argv[argv.indexOf("--id") + 1] : null;

const FORMATS = ["carousel", "story", "reel"];
const MAX_FAILURES = 3;
const SLOT_WINDOW_MIN = 20;
const ROTATION = (process.env.CONTENT_ROTATION_IST || "tech,news,govt,events,ai")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

// Instagram allows 5 hashtags per post (Dec 2025). They label the topic; reach comes from
// the words in the caption, which Instagram search reads.
const MAX_HASHTAGS = 5;
const CATEGORY_HASHTAGS = {
  tech: "#jobsforfreshers #offcampusdrive #freshersjobs #internship #placements",
  news: "#technews #engineeringstudents #techupdates #developers #coding",
  govt: "#governmentjobs #sarkarinaukri #govtjobs #sscexam #freshers",
  events: "#hackathon #codingcontest #engineeringstudents #hackathonindia #students",
  ai: "#ainews #artificialintelligence #engineeringstudents #techupdates #learnai",
};
// The phrases students type into Instagram search, added when the caption has none of them
const CATEGORY_SEARCH = {
  tech: ["jobs for freshers", "Jobs for freshers and off campus drives in India, with verified apply links."],
  news: ["tech news", "Tech news for engineering students in India, in under a minute."],
  govt: ["government jobs", "Government jobs for graduates in India, with verified notification links."],
  events: ["hackathon", "Hackathons and coding contests for college students in India, with the registration deadlines."],
  ai: ["ai news", "AI news for engineering students in India, in under a minute."],
};

function rotationForDate(date) {
  const day = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86400000;
  return ROTATION[Math.abs(Math.floor(day)) % ROTATION.length];
}

const tagsIn = (text) => String(text || "").match(/#[\p{L}\p{N}_]+/gu) || [];

// The row's own (specific) tags first, then category defaults; the brand tag is dropped
// because nobody searches for it.
function withCategoryHashtags(row, category) {
  const seen = new Set();
  return [...tagsIn(row.Hashtags), ...tagsIn(CATEGORY_HASHTAGS[category])]
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (key === "#beyondtheoffer" || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_HASHTAGS)
    .join(" ");
}

export function buildCaption(row, category) {
  // Hashtags typed into the caption body would count towards the limit too ("#1" stays)
  const body = String(row.Caption || "").replace(/(^|\s)#\p{L}[\p{L}\p{N}_]*/gu, "$1").replace(/[ \t]+$/gm, "").trim();
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
  const [phrase, line] = CATEGORY_SEARCH[category] || CATEGORY_SEARCH.tech;
  // The search line goes before the closing ask, so the caption still ends on it
  if (!body.toLowerCase().includes(phrase)) paragraphs.splice(Math.max(1, paragraphs.length - 1), 0, line);
  return [...paragraphs, withCategoryHashtags(row, category)].filter(Boolean).join("\n\n");
}

// Reels reach non-followers first, which matters most while the account is small.
// They need a feed post (share_to_feed) and stay off the grid until they graduate.
const FORMAT_PRIORITY = { reel: 0, carousel: 1, story: 2 };

// "@a, b" → ["a", "b"]; Instagram takes up to 3 collaborators on feed posts and reels
const collaboratorsFor = (row) =>
  String(row.Collaborators || "")
    .split(/[,\s]+/)
    .map((u) => u.replace(/^@/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

const slotMinutes = (process.env.POST_SLOTS_IST || "09:00,13:00,19:00")
  .split(",")
  .map((s) => s.trim().match(/^(\d{1,2}):(\d{2})$/))
  .filter(Boolean)
  .map((m) => Number(m[1]) * 60 + Number(m[2]));

// "2026-11-02 09:00", "02/11/2026 9:00" or "09:00" (today) → "YYYY-MM-DD HH:MM" in IST
function scheduleKey(value, today) {
  const s = String(value || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4].padStart(2, "0")}:${m[5]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")} ${m[4].padStart(2, "0")}:${m[5]}`;
  m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return `${today} ${m[1].padStart(2, "0")}:${m[2]}`;
  return null;
}

function failureCounts(runLogRows) {
  const counts = {};
  for (const r of runLogRows) {
    const m = (r.Notes || "").match(/^publish FAILED (\S+?):/);
    if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  return counts;
}

function pickRow(rows, failures) {
  const now = nowInZone();
  const nowKey = `${now.date} ${now.time}`;
  const rotation = rotationForDate(now.date);
  const inSlot = slotMinutes.some((slot) => Math.abs(now.minutes - slot) <= SLOT_WINDOW_MIN);

  const approved = rows.filter(
    (r) =>
      r.Status === "Approved" &&
      // Fixture rows have no admin preview step
      (sample || (r.Publish_Confirmed === "Y" && r.Preview_Link)) &&
      FORMATS.includes((r.Format || "").toLowerCase()) &&
      r.Slides_or_Script
  );
  if (forcedId) return { row: approved.find((r) => r.ID === forcedId), reason: `--id ${forcedId}` };

  const usable = approved.filter((r) => (failures[r.ID] || 0) < MAX_FAILURES);
  const blocked = approved.length - usable.length;
  if (blocked) console.log(`${blocked} approved row(s) skipped after ${MAX_FAILURES} failed runs; check Run_Log.`);

  const scheduled = usable
    .map((r) => ({ r, key: scheduleKey(r.Scheduled_Time_IST, now.date) }))
    .filter((x) => x.key && x.key <= nowKey)
    .sort((a, b) => a.key.localeCompare(b.key));
  if (scheduled.length) return { row: scheduled[0].r, reason: `scheduled for ${scheduled[0].key} IST` };

  // Today's rotation goes first, but a day without a matching row still posts something:
  // a slot left empty costs more reach than an off-theme post.
  const rank = (r) => (categoryForRow(r) === rotation ? 0 : 10) + (FORMAT_PRIORITY[r.Format.toLowerCase()] ?? 5);
  const unscheduled = usable.filter((r) => !r.Scheduled_Time_IST).sort((a, b) => rank(a) - rank(b));
  const pick = unscheduled[0];
  const why = pick && categoryForRow(pick) !== rotation ? `no ${rotation} row approved, using ${categoryForRow(pick)}` : `${rotation} rotation`;
  if (ignoreSlots) return { row: pick, reason: `time slots ignored (--dry-run / --now), ${why}` };
  if (!inSlot) return { row: null, reason: `outside posting slots (${process.env.POST_SLOTS_IST || "19:00"} IST ±${SLOT_WINDOW_MIN} min)` };
  return { row: pick, reason: `${why} at posting slot` };
}

async function loadRows() {
  if (sample) {
    const rows = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures", "content-queue.sample.json"), "utf8"));
    const format = argv.includes("--format") ? argv[argv.indexOf("--format") + 1].toLowerCase() : null;
    return { rows: format ? rows.filter((r) => r.Format.toLowerCase() === format) : rows, headers: null, failures: {} };
  }
  const [{ rows, headers }, runLog] = await Promise.all([
    readTab(TABS.queue),
    readTab(TABS.runLog).catch(() => ({ rows: [] })),
  ]);
  return { rows, headers, failures: failureCounts(runLog.rows) };
}

// Renders the row: reels and stories become voiced videos, carousels themed slides.
async function renderRow(row, outDir) {
  const format = row.Format.toLowerCase();
  const category = categoryForRow(row);
  const { buildReel, renderPostSlides, slidesToCards } = await import("./reels.js");
  if (format === "reel") {
    const reel = await buildReel(row.Slides_or_Script, outDir, { category });
    return { images: [], video: reel.file, note: `${reel.seconds}s reel` };
  }
  const slides = parseSlides(row.Slides_or_Script);
  if (format === "story") {
    const cards = slidesToCards(slides, { title: row.Title, category, complete: true });
    const story = await buildReel(row.Slides_or_Script, outDir, { category, cards });
    return { images: [], video: story.file, note: `${story.seconds}s story video` };
  }
  if (slides.length > 20) throw new Error(`Carousel has ${slides.length} slides; Instagram allows 20`);
  const images = await renderPostSlides(slides, outDir, { category, script: row.Slides_or_Script });
  return { images, video: null, note: `${images.length} slide(s)` };
}

async function publishToInstagram(row, imageUrls, video) {
  const ig = await import("./lib/instagram.js");
  // Every post gets its own links page, which comment-to-DM replies can point to
  const linksLine = /\/links\//.test(row.Caption || "") ? "" : `🔗 All apply links: ${WEBSITE_URL.replace(/^https?:\/\//, "")}/links/${row.ID}`;
  const format = row.Format.toLowerCase();
  const category = categoryForRow(row);
  const caption = buildCaption(row, category);
  const collaborators = collaboratorsFor(row);

  const { used, total } = await ig.getPublishingLimit();
  const needed = format === "story" && !video ? imageUrls.length : 1;
  if (used + needed > total) throw new Error(`Publishing limit reached (${used}/${total} in 24 h)`);

  if (format === "story" && video) {
    const id = await ig.createStoryVideoContainer(video);
    await ig.waitUntilFinished(id, { intervalMs: 20_000, maxMs: 10 * 60_000 });
    const mediaId = await ig.publish(id);
    return { mediaId, permalink: `story:${mediaId}` };
  }

  if (format === "story") {
    let firstId = null;
    for (const url of imageUrls) {
      const id = await ig.createStoryContainer(url);
      await ig.waitUntilFinished(id);
      const mediaId = await ig.publish(id);
      firstId ??= mediaId;
    }
    // Stories have no lasting permalink; store the media id instead.
    return { mediaId: firstId, permalink: `story:${firstId}` };
  }

  let creationId;
  if (format === "reel") {
    creationId = await ig.createReelContainerFromUrl(video, caption, { collaborators, trial: process.env.REEL_TRIAL });
  } else if (imageUrls.length === 1) {
    creationId = await ig.createImageContainer(imageUrls[0], { caption, collaborators });
  } else {
    const children = [];
    for (const url of imageUrls) children.push(await ig.createImageContainer(url, { isCarouselItem: true }));
    creationId = await ig.createCarouselContainer(children, caption, { collaborators });
  }
  // Video needs longer to process than images
  await ig.waitUntilFinished(creationId, format === "reel" ? { intervalMs: 20_000, maxMs: 10 * 60_000 } : {});
  const mediaId = await ig.publish(creationId);
  return { mediaId, permalink: await ig.getPermalink(mediaId) };
}

// Posted_On_IG=Y on every item in Item_IDs (Used_In_Post=Y for news).
async function markItemsPosted(itemIds) {
  const remaining = new Set(itemIds);
  for (const tab of [TABS.tech, TABS.govt, TABS.events, TABS.news]) {
    if (!remaining.size) break;
    const { headers, rows } = await readTab(tab);
    const column = tab === TABS.news ? "Used_In_Post" : "Posted_On_IG";
    for (const r of rows) {
      if (remaining.has(r.ID)) {
        await updateRow(tab, headers, r._row, { [column]: "Y" });
        remaining.delete(r.ID);
      }
    }
  }
  if (remaining.size) console.log(`Item IDs not found in any tab: ${[...remaining].join(", ")}`);
}

async function main() {
  const { rows, headers, failures } = await loadRows();
  const { row, reason } = pickRow(rows, failures);

  if (checkOnly) {
    console.log(row ? `Due: ${row.ID} (${reason})` : `Nothing due: ${reason}`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `due=${row ? "true" : "false"}\n`);
    return;
  }
  if (!row) {
    console.log(`Nothing to publish: ${reason || "no approved rows"}.`);
    return;
  }

  console.log(`${dryRun ? "[dry run] " : ""}${row.ID} · ${row.Format} · "${row.Title}" (${reason})`);
  if (!dryRun) {
    const { refreshToken } = await import("./lib/instagram.js");
    await refreshToken();
  }

  const outDir = path.join(ROOT, "renders", row.ID);
  // Reels and stories post the exact video approved in the admin preview
  const approvedVideo = ["reel", "story"].includes(row.Format.toLowerCase())
    ? (row.Preview_Link || "").split(/\s+/).find((u) => /^https:\/\/\S+\.mp4(\?|$)/i.test(u))
    : null;
  try {
    const { images, video, note } = approvedVideo ? { images: [], video: null, note: "approved preview reel" } : await renderRow(row, outDir);
    await closeBrowser();
    console.log(approvedVideo ? `Using the approved preview: ${approvedVideo}` : `Rendered ${note} → ${path.relative(process.cwd(), outDir) || outDir}`);

    let urls = [];
    if (images.length && hasCloudinary()) {
      urls = await uploadSlides(images, row.ID);
      console.log(`Uploaded to Cloudinary:\n  ${urls.join("\n  ")}`);
    } else if (images.length) {
      if (!dryRun) throw new Error("Cloudinary credentials missing; Instagram needs public image URLs");
      console.log("Cloudinary not configured: skipped upload.");
    }

    let videoUrl = approvedVideo || null;
    if (video && hasCloudinary()) {
      videoUrl = await uploadVideo(video, { folder: `beyondtheoffer/${row.ID}`, publicId: "reel" });
      console.log(`Uploaded reel to Cloudinary:\n  ${videoUrl}`);
    } else if (video && !dryRun) {
      throw new Error("Cloudinary credentials missing; Instagram needs a public video URL for reels");
    }

    if (dryRun) {
      console.log("Dry run: nothing published. Set DRY_RUN=false to post.");
      return;
    }

    const { permalink } = await publishToInstagram(row, urls, videoUrl);
    console.log(`Published: ${permalink}`);

    if (!sample) {
      await updateRow(TABS.queue, headers, row._row, {
        Status: "Published",
        IG_Post_Link: permalink,
        Design_Link: urls[0] || "",
      });
      await markItemsPosted((row.Item_IDs || "").split(/[,\s]+/).filter(Boolean));
      await logRun(`publish OK ${row.ID}: ${permalink}`);
    }
  } catch (err) {
    await closeBrowser();
    console.error(`publish failed for ${row.ID}: ${err.message}`);
    if (!sample && !dryRun) {
      const failuresSoFar = (failures[row.ID] || 0) + 1;
      await logRun(`publish FAILED ${row.ID}: ${err.message.slice(0, 300)} (attempt ${failuresSoFar}/${MAX_FAILURES})`).catch(
        (e) => console.error(`could not write Run_Log: ${e.message}`)
      );
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`publish failed: ${err.message}`);
  process.exit(1);
});
