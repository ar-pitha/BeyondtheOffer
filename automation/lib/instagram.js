// Publishing helpers on top of the shared Instagram client.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { igRequest, igUserId } from "../../frontend/api/_lib/instagram.js";

export * from "../../frontend/api/_lib/instagram.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const createImageContainer = (imageUrl, { isCarouselItem = false, caption } = {}) =>
  igRequest(`${igUserId()}/media`, {
    method: "POST",
    params: { image_url: imageUrl, is_carousel_item: isCarouselItem || undefined, caption: isCarouselItem ? undefined : caption },
  }).then((d) => d.id);

export function createCarouselContainer(childIds, caption) {
  if (childIds.length < 2 || childIds.length > 20) throw new Error(`A carousel needs 2–20 items, got ${childIds.length}`);
  return igRequest(`${igUserId()}/media`, {
    method: "POST",
    params: { media_type: "CAROUSEL", children: childIds.join(","), caption },
  }).then((d) => d.id);
}

export const createStoryContainer = (imageUrl) =>
  igRequest(`${igUserId()}/media`, { method: "POST", params: { media_type: "STORIES", image_url: imageUrl } }).then(
    (d) => d.id
  );

// Reels from a public MP4 URL (Cloudinary). This works with unified-login tokens,
// where rupload.facebook.com rejects direct uploads.
export const createReelContainerFromUrl = (videoUrl, caption) =>
  igRequest(`${igUserId()}/media`, {
    method: "POST",
    params: { media_type: "REELS", video_url: videoUrl, caption, share_to_feed: true },
  }).then((d) => d.id);

// Reels via resumable upload (Instagram-login tokens): no public video hosting needed.
export async function createReelContainer(filePath, caption) {
  const { id, uri } = await igRequest(`${igUserId()}/media`, {
    method: "POST",
    params: { media_type: "REELS", upload_type: "resumable", caption },
  });
  const file = fs.readFileSync(filePath);
  const res = await fetch(uri || `https://rupload.facebook.com/ig-api-upload/${process.env.IG_API_VERSION || "v26.0"}/${id}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${process.env.IG_ACCESS_TOKEN}`,
      offset: "0",
      file_size: String(file.length),
    },
    body: file,
  });
  if (!res.ok) throw new Error(`Reel upload failed ${res.status}: ${await res.text()}`);
  return id;
}

// Polls status_code once a minute (first check after 10 s), up to 5 minutes.
export async function waitUntilFinished(containerId, { intervalMs = 60_000, maxMs = 5 * 60_000 } = {}) {
  const started = Date.now();
  let wait = 10_000;
  while (true) {
    await sleep(wait);
    const { status_code: status, status: detail } = await igRequest(containerId, { params: { fields: "status_code,status" } });
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") throw new Error(`Container ${containerId} ${status}: ${detail || ""}`);
    if (Date.now() - started + intervalMs > maxMs) throw new Error(`Container ${containerId} still ${status} after 5 minutes`);
    wait = intervalMs;
  }
}

export const publish = (creationId) =>
  igRequest(`${igUserId()}/media_publish`, { method: "POST", params: { creation_id: creationId } }).then((d) => d.id);

export const getPermalink = (mediaId) => igRequest(mediaId, { params: { fields: "permalink" } }).then((d) => d.permalink);

export async function getPublishingLimit() {
  const { data = [] } = await igRequest(`${igUserId()}/content_publishing_limit`, { params: { fields: "config,quota_usage" } });
  const row = data[0] || {};
  return { used: row.quota_usage ?? 0, total: row.config?.quota_total ?? 100 };
}

// Long-lived tokens last 60 days. In CI we only warn (printing a fresh token into
// Actions logs would leak it); run `node lib/instagram.js refresh` locally instead.
export async function refreshToken({ force = false } = {}) {
  const issued = process.env.IG_TOKEN_ISSUED_AT ? new Date(process.env.IG_TOKEN_ISSUED_AT) : null;
  const ageDays = issued ? Math.floor((Date.now() - issued) / 86_400_000) : null;
  if (!force && (ageDays === null || ageDays < 50)) {
    if (ageDays === null) console.log("Tip: set IG_TOKEN_ISSUED_AT (YYYY-MM-DD) to get token refresh reminders.");
    return null;
  }
  if (process.env.CI && !force) {
    console.warn(
      `::warning::Instagram token is ${ageDays} days old (expires at 60). Run "node lib/instagram.js refresh" locally, ` +
        "then update IG_ACCESS_TOKEN and IG_TOKEN_ISSUED_AT in GitHub Secrets and Vercel."
    );
    return null;
  }
  const base = process.env.IG_API_BASE || "https://graph.instagram.com";
  let url;
  if (base.includes("graph.facebook.com")) {
    // Unified login (EAA… tokens): exchange for a fresh long-lived token with the Meta app credentials
    if (!process.env.IG_APP_ID || !process.env.IG_APP_SECRET) throw new Error("IG_APP_ID and IG_APP_SECRET are needed to refresh this token");
    url = new URL(`${base}/${process.env.IG_API_VERSION || "v21.0"}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", process.env.IG_APP_ID);
    url.searchParams.set("client_secret", process.env.IG_APP_SECRET);
    url.searchParams.set("fb_exchange_token", process.env.IG_ACCESS_TOKEN);
  } else {
    url = new URL(`${base}/refresh_access_token`);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", process.env.IG_ACCESS_TOKEN);
  }
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${data.error?.message || res.status}`);
  return data;
}

// CLI: node lib/instagram.js refresh | limit
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await import("./config.js");
  const cmd = process.argv[2];
  if (cmd === "refresh") {
    const data = await refreshToken({ force: true });
    const today = new Date().toISOString().slice(0, 10);
    const days = data.expires_in ? `valid ${Math.round(data.expires_in / 86400)} days` : "no expiry reported";
    console.log(`New token (${days}):\n\n${data.access_token}\n`);
    console.log(`Update IG_ACCESS_TOKEN everywhere (automation/.env, GitHub Secrets, Vercel) and set IG_TOKEN_ISSUED_AT=${today}`);
  } else if (cmd === "limit") {
    console.log(await getPublishingLimit());
  } else {
    console.log("Usage: node lib/instagram.js refresh | limit");
  }
}
