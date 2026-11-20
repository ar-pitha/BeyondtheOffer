// Daily snapshot of post performance → "Insights" sheet tab (created if missing).
//   node insights.js            posts from the last 30 days
//   node insights.js --dry-run  print instead of writing

import { TABS, isDryRun } from "./lib/config.js";
import { ensureTab, ensureColumns, appendRow, nowInZone } from "./lib/sheets.js";
import { igRequest, igUserId } from "./lib/instagram.js";

const HEADERS = [
  "Date", "Media_ID", "Permalink", "Media_Type", "Posted_At",
  "Reach", "Views", "Saves", "Shares", "Likes", "Comments", "Followers",
  // What decides whether Instagram shows a post to a second, bigger batch of people: shares per
  // account reached (the post that reached 900 had 1.7%, the ones stuck near 135 had 0), how long
  // a reel is watched, and whether people follow from it
  "Format", "Avg_Watch_s", "Follows", "Profile_Visits", "Shares_per_100_Reach",
];
const DAYS = 30;

const values = (data = []) => Object.fromEntries(data.map((m) => [m.name, m.values?.[0]?.value ?? m.total_value?.value ?? ""]));

async function mediaInsights(media) {
  const reel = media.media_product_type === "REELS";
  const metrics = ["reach", "views", "saved", "shares", "likes", "comments", ...(reel ? ["ig_reels_avg_watch_time"] : ["follows", "profile_visits"])];
  try {
    const { data } = await igRequest(`${media.id}/insights`, { params: { metric: metrics.join(",") } });
    return values(data);
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
    params: { fields: "id,permalink,media_type,media_product_type,timestamp,like_count,comments_count", limit: 50 },
  });

  const since = Date.now() - DAYS * 86_400_000;
  const recent = media.filter((m) => new Date(m.timestamp).getTime() >= since);
  const { date } = nowInZone();

  let headers = HEADERS;
  if (!dryRun) {
    await ensureTab(TABS.insights, HEADERS);
    // Tabs made before the newer columns get them appended, so old rows keep their places
    headers = await ensureColumns(TABS.insights, HEADERS);
  }
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
      Format: m.media_product_type === "REELS" ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carousel" : m.media_type,
      Avg_Watch_s: ins.ig_reels_avg_watch_time ? (ins.ig_reels_avg_watch_time / 1000).toFixed(1) : "",
      Follows: ins.follows ?? "",
      Profile_Visits: ins.profile_visits ?? "",
      Shares_per_100_Reach: ins.reach ? ((100 * (ins.shares || 0)) / ins.reach).toFixed(1) : "",
    };
    if (dryRun) console.log(row);
    else await appendRow(TABS.insights, headers, row);
  }
  console.log(`Insights: ${recent.length} post(s) from the last ${DAYS} days, ${followers} followers${dryRun ? " (dry run)" : ""}.`);
}

main().catch((err) => {
  console.error(`insights failed: ${err.message}`);
  process.exit(1);
});
