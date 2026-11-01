// Daily snapshot of post performance → "Insights" sheet tab (created if missing).
//   node insights.js            posts from the last 30 days
//   node insights.js --dry-run  print instead of writing

import { TABS, isDryRun } from "./lib/config.js";
import { ensureTab, appendRow, nowInZone } from "./lib/sheets.js";
import { igRequest, igUserId } from "./lib/instagram.js";

const HEADERS = [
  "Date", "Media_ID", "Permalink", "Media_Type", "Posted_At",
  "Reach", "Views", "Saves", "Shares", "Likes", "Comments", "Followers",
];
const DAYS = 30;

async function mediaInsights(media) {
  const metrics = ["reach", "views", "saved", "shares", "likes", "comments"];
  try {
    const { data = [] } = await igRequest(`${media.id}/insights`, { params: { metric: metrics.join(",") } });
    return Object.fromEntries(data.map((m) => [m.name, m.values?.[0]?.value ?? m.total_value?.value ?? ""]));
  } catch (err) {
    // Older posts or stories can reject some metrics; fall back to the counts on the media object.
    console.log(`  ${media.id}: ${err.message}`);
    return { likes: media.like_count ?? "", comments: media.comments_count ?? "" };
  }
}

async function main() {
  const dryRun = isDryRun();
  const { followers_count: followers } = await igRequest(igUserId(), { params: { fields: "followers_count,media_count" } });
  const { data: media = [] } = await igRequest(`${igUserId()}/media`, {
    params: { fields: "id,permalink,media_type,timestamp,like_count,comments_count", limit: 50 },
  });

  const since = Date.now() - DAYS * 86_400_000;
  const recent = media.filter((m) => new Date(m.timestamp).getTime() >= since);
  const { date } = nowInZone();

  if (!dryRun) await ensureTab(TABS.insights, HEADERS);
  for (const m of recent) {
    const ins = await mediaInsights(m);
    const row = {
      Date: date,
      Media_ID: m.id,
      Permalink: m.permalink,
      Media_Type: m.media_type,
      Posted_At: m.timestamp,
      Reach: ins.reach ?? "",
      Views: ins.views ?? "",
      Saves: ins.saved ?? "",
      Shares: ins.shares ?? "",
      Likes: ins.likes ?? m.like_count ?? "",
      Comments: ins.comments ?? m.comments_count ?? "",
      Followers: followers,
    };
    if (dryRun) console.log(row);
    else await appendRow(TABS.insights, HEADERS, row);
  }
  console.log(`Insights: ${recent.length} post(s) from the last ${DAYS} days, ${followers} followers${dryRun ? " (dry run)" : ""}.`);
}

main().catch((err) => {
  console.error(`insights failed: ${err.message}`);
  process.exit(1);
});
