// Tech news groups itself: every free fresh story goes into a waiting post (3 to 6 similar
// stories each) in /admin/feed → Posts, with no schedule to wait for. The board does this every
// time it opens (frontend/api/admin-sheet.js); daily-news.yml runs this script as a backup so the
// posts and their previews are ready before anyone opens it. Nothing is posted by itself: an
// admin sends each one with "Post now". Jobs, govt jobs and hackathons are grouped by hand.
//   node news-daily.js            write the new posts to Content_Queue
//   node news-daily.js --dry-run  only print the groups it would make and render the first one

import fs from "node:fs";
import path from "node:path";
import { ROOT, TABS, isDryRun } from "./lib/config.js";
import { readTab, appendRow, ensureColumns, nowInZone, logRun } from "./lib/sheets.js";
import { CATEGORIES, newsPosts } from "../frontend/api/_lib/carousel.js";

async function main() {
  const dryRun = isDryRun();
  const { date } = nowInZone();
  const [queue, ...read] = await Promise.all([TABS.queue, ...Object.values(CATEGORIES).map((c) => c.tab)].map((t) => readTab(t)));
  const tabRows = Object.fromEntries(Object.values(CATEGORIES).map((c, i) => [c.tab, read[i].rows]));
  const output = (pairs) => {
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(pairs).map(([k, v]) => `${k}=${v}
`).join(""));
  };

  const made = newsPosts(queue.rows, tabRows, date);
  if (!made.length) {
    console.log("No new posts: every fresh story is already in a post, or fewer than 3 are free.");
    return output({ due: "false" });
  }
  for (const row of made) console.log(`${row.ID} · ${row._theme} · ${row.Item_IDs}`);

  if (dryRun) {
    const { renderPost } = await import("./lib/post.js");
    const { closeBrowser } = await import("./lib/render.js");
    const files = await renderPost(made[0], path.join(ROOT, "renders", "news-dry-run"), { category: "news" });
    await closeBrowser();
    console.log(`[dry run] would add ${made.length} post(s); first one has ${files.length} slides in renders/news-dry-run`);
    return output({ due: "false" });
  }

  const headers = await ensureColumns(TABS.queue, ["Preview_Link", "Publish_Confirmed"]);
  for (const row of made) await appendRow(TABS.queue, headers, row);
  await logRun(`news grouped ${made.map((r) => `${r.ID} (${r._theme})`).join(", ")}`).catch(() => {});
  output({ due: "true" });
}

main().catch(async (err) => {
  console.error(err.message);
  await logRun(`news grouping FAILED: ${err.message.slice(0, 300)}`).catch(() => {});
  process.exit(1);
});
