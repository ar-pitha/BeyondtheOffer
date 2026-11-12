// The daily tech news post. Every day at 5 PM IST one carousel of 3 to 6 similar stories goes out
// by itself (daily-news.yml); jobs, govt jobs and hackathons are grouped by hand in /admin/feed.
// This script picks the stories and writes the post as Approved; the workflow then builds the
// preview, waits for 17:00 IST and publishes it with publish.js.
//   node news-daily.js            write today's post (or reuse it) and print its ID
//   node news-daily.js --dry-run  only print the stories it would pick and render the slides
// Safe to run again: once today's news post is out it does nothing, and a post already written
// today is reused, so the backup runs in daily-news.yml never post twice.

import fs from "node:fs";
import path from "node:path";
import { ROOT, TABS, isDryRun } from "./lib/config.js";
import { readTab, appendRow, updateRow, ensureColumns, nowInZone, logRun } from "./lib/sheets.js";
import { CATEGORIES, GROUPED, MAX_STORIES, carouselFields, takenBy } from "../frontend/api/_lib/carousel.js";
import { alreadyPosted, igRejected, parseSheetDate } from "../frontend/api/_lib/queue.js";

const MIN_STORIES = 3;
const FILL_TO = 4; // a theme with fewer stories is topped up with the newest others
const FRESH_DAYS = 3; // stories dated within the last 3 days
const DAY = 86_400_000;

// The sheet's Topic is free text ("Security", "Cybersecurity"); similar ones share a theme
const THEMES = [
  ["Security", /secur|cyber|privacy|hack|breach|malware/i],
  ["AI", /\bai\b|model|machine learning|llm|robot|agent/i],
  ["Developer tools", /develop|dev ?tools|programming|open source|software|coding/i],
  ["Cloud and hardware", /cloud|hardware|chip|semiconductor|space|quantum/i],
  ["Jobs and industry", /job|industry|career|education|hiring|layoff|big tech|startup/i],
  ["Policy", /policy|regulat|law|govern|web/i],
];
export const themeOf = (story) => (THEMES.find(([, re]) => re.test(story.Topic || "")) || ["Other"])[0];

const storyTime = (s) => parseSheetDate(s.Date)?.getTime() || 0;

// Picks today's stories: the theme with the most fresh stories, newest first, up to 6; topped up
// with the newest other fresh stories when the theme has fewer than 4. Null when under 3.
export function pickStories(stories, now = Date.now()) {
  const fresh = stories.filter((s) => now - storyTime(s) < FRESH_DAYS * DAY).sort((a, b) => storyTime(b) - storyTime(a));
  if (fresh.length < MIN_STORIES) return null;
  const counts = new Map();
  for (const s of fresh) counts.set(themeOf(s), (counts.get(themeOf(s)) || 0) + 1);
  // Most stories wins; on a tie, the theme with the newest story (fresh is newest first)
  const theme = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a))[0];
  const picked = fresh.filter((s) => themeOf(s) === theme).slice(0, MAX_STORIES);
  for (const s of fresh) if (picked.length < FILL_TO && !picked.includes(s)) picked.push(s);
  return { theme, stories: picked.sort((a, b) => storyTime(b) - storyTime(a)) };
}

const isNewsPost = (r) => String(r.Item_IDs || "").split(/[,\s]+/).filter(Boolean).every((id) => id.startsWith("TN-"));

async function main() {
  const dryRun = isDryRun();
  const { date } = nowInZone();
  const today = `CQ-${date.replace(/-/g, "")}-G`;
  const [queue, ...read] = await Promise.all([TABS.queue, ...Object.values(CATEGORIES).map((c) => c.tab)].map((t) => readTab(t)));
  const tabRows = Object.fromEntries(Object.values(CATEGORIES).map((c, i) => [c.tab, read[i].rows]));
  const output = (pairs) => {
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(pairs).map(([k, v]) => `${k}=${v}\n`).join(""));
  };

  const todays = queue.rows.filter((r) => r.ID.startsWith(today) && GROUPED.test(r.ID) && isNewsPost(r));
  const posted = todays.find((r) => r.Status === "Published");
  if (posted) {
    console.log(`Today's news post is already out: ${posted.ID}`);
    return output({ due: "false" });
  }
  // Written by an earlier run today (a backup run, or one that failed to publish): post that one
  const waiting = todays.find((r) => ["Draft", "Approved"].includes(r.Status));
  if (waiting && !dryRun) {
    const headers = await ensureColumns(TABS.queue, ["Publish_Confirmed"]);
    await updateRow(TABS.queue, headers, waiting._row, { Status: "Approved", Publish_Confirmed: "Y" }, { raw: true });
    console.log(`Using today's news post ${waiting.ID}`);
    return output({ due: "true", id: waiting.ID });
  }

  const owner = takenBy(queue.rows, new Map(Object.values(tabRows).flat().filter((r) => r.ID).map((r) => [r.ID, r])));
  const free = tabRows.Tech_News.filter((s) => s.ID && s.Headline && !alreadyPosted(s) && !igRejected(s) && !owner.has(s.ID));
  const pick = pickStories(free);
  if (!pick) {
    const note = `daily news SKIPPED ${date}: fewer than ${MIN_STORIES} unused stories from the last ${FRESH_DAYS} days`;
    console.log(note);
    if (!dryRun) await logRun(note).catch(() => {});
    return output({ due: "false" });
  }
  console.log(`Theme: ${pick.theme}`);
  for (const s of pick.stories) console.log(`  ${s.ID} · ${s.Date} · ${s.Topic} · ${s.Headline}`);

  const fields = carouselFields("news", pick.stories);
  if (dryRun) {
    const { renderPost } = await import("./lib/post.js");
    const { closeBrowser } = await import("./lib/render.js");
    const files = await renderPost({ ID: "news-dry-run", Format: "Carousel", ...fields }, path.join(ROOT, "renders", "news-dry-run"), { category: "news" });
    await closeBrowser();
    console.log(`[dry run] would post "${fields.Title}" (${files.length} slides in renders/news-dry-run)`);
    return output({ due: "false" });
  }

  const headers = await ensureColumns(TABS.queue, ["Preview_Link", "Publish_Confirmed"]);
  const n = 1 + Math.max(0, ...queue.rows.filter((r) => r.ID.startsWith(today)).map((r) => Number(r.ID.slice(today.length)) || 0));
  const row = { ID: `${today}${n}`, Date: date, Format: "Carousel", Status: "Approved", Publish_Confirmed: "Y", ...fields };
  await appendRow(TABS.queue, headers, row);
  await logRun(`daily news grouped ${row.ID}: ${pick.theme}, ${pick.stories.length} stories`).catch(() => {});
  console.log(`Wrote ${row.ID}: "${row.Title}"`);
  output({ due: "true", id: row.ID });
}

// Self-check: node news-daily.js --self-check
if (process.argv.includes("--self-check")) {
  const { default: assert } = await import("node:assert");
  const day = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
  const s = (id, topic, d) => ({ ID: id, Topic: topic, Date: day(d), Headline: id });
  const stories = [
    s("A", "Cybersecurity", 0), s("B", "Security", -1), s("C", "AI models", 0), s("D", "Open models", -1),
    s("E", "AI research", -2), s("F", "Cybersecurity", -10), s("G", "Developer tools", 0),
  ];
  const p = pickStories(stories);
  assert.strictEqual(p.theme, "AI"); // 3 fresh AI stories beat 2 fresh security ones; F is too old
  assert.deepStrictEqual(p.stories.map((x) => x.ID).sort(), ["A", "C", "D", "E"]); // topped up to 4 with the newest other
  assert.strictEqual(pickStories(stories.slice(5)), null); // 1 fresh story: no post
  const many = Array.from({ length: 9 }, (_, i) => s(`S${i}`, "Security", 0));
  assert.strictEqual(pickStories(many).stories.length, MAX_STORIES);
  assert.strictEqual(themeOf({ Topic: "Cloud / Hardware" }), "Cloud and hardware");
  console.log("news-daily.js ok");
} else {
  main().catch(async (err) => {
    console.error(err.message);
    await logRun(`daily news FAILED: ${err.message.slice(0, 300)}`).catch(() => {});
    process.exit(1);
  });
}
