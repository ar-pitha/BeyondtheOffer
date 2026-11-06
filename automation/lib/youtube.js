// YouTube Shorts uploader (YouTube Data API v3, OAuth refresh token; no SDK).
//   node lib/youtube.js auth            one-time login in the browser → saves YT_REFRESH_TOKEN to .env
//   node lib/youtube.js channel         which channel the token uploads to
//   node lib/youtube.js upload file.mp4 "Title" [description]   private test upload
//
// Needs YT_CLIENT_ID, YT_CLIENT_SECRET (a "Desktop app" OAuth client with the YouTube Data API
// enabled) and YT_REFRESH_TOKEN. Service accounts can't upload to a channel.
// Uploads from an API project that hasn't passed YouTube's audit are locked to private,
// so YT_PRIVACY defaults to private; set it to public once the audit is approved.
// Each upload costs about 1,600 of the default 10,000 daily quota units.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./config.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";
const EDUCATION = "27";

export const hasYouTube = () => Boolean(process.env.YT_CLIENT_ID && process.env.YT_CLIENT_SECRET && process.env.YT_REFRESH_TOKEN);

async function accessToken() {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YT_CLIENT_ID,
      client_secret: process.env.YT_CLIENT_SECRET,
      refresh_token: process.env.YT_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json().catch(() => ({}));
  // invalid_grant: the refresh token was revoked, or expired after 7 days because the
  // OAuth consent screen is still in "Testing"; publish the consent screen and run auth again.
  if (!res.ok) throw new Error(`YouTube token refresh failed: ${data.error || res.status} ${data.error_description || ""}`.trim());
  return data.access_token;
}

async function ytError(res) {
  const data = await res.json().catch(() => ({}));
  const e = data.error || {};
  return new Error(`YouTube ${res.status}: ${e.errors?.[0]?.reason || ""} ${e.message || ""}`.trim());
}

// Title max 100 characters, description max 5,000, neither may contain < or >
const clean = (s, max) => String(s || "").replace(/[<>]/g, "").trim().slice(0, max);

// Shorts are vertical videos up to 3 minutes; "#Shorts" in the title is no longer
// required but still helps the first few uploads get classified.
export function shortsMetadata({ title, description, tags = [], privacy = process.env.YT_PRIVACY || "private" }) {
  const base = clean(title, 100);
  const withTag = /#shorts/i.test(base) || base.length > 91 ? base : `${base} #Shorts`;
  return {
    snippet: {
      title: withTag,
      description: clean(description, 5000),
      tags: [...new Set(tags.map((t) => String(t).replace(/^#/, "").toLowerCase()))].filter((t) => t && t !== "beyondtheoffer").slice(0, 15),
      categoryId: process.env.YT_CATEGORY_ID || EDUCATION,
      defaultLanguage: process.env.YT_LANGUAGE || "en",
      defaultAudioLanguage: process.env.YT_LANGUAGE || "en",
    },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false, embeddable: true },
  };
}

// video: a local path or a public https URL (the approved Cloudinary preview)
export async function videoBytes(video) {
  if (/^https:\/\//i.test(video)) {
    const res = await fetch(video);
    if (!res.ok) throw new Error(`Couldn't download ${video}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(video);
}

export async function uploadShort(video, meta) {
  const token = await accessToken();
  const bytes = await videoBytes(video);
  const start = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(bytes.length),
    },
    body: JSON.stringify(meta),
  });
  if (!start.ok) throw await ytError(start);
  const res = await fetch(start.headers.get("location"), {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "video/mp4" },
    body: bytes,
  });
  if (!res.ok) throw await ytError(res);
  const { id, status } = await res.json();
  return { id, url: `https://youtube.com/shorts/${id}`, privacy: status?.privacyStatus };
}

export async function channelInfo() {
  const token = await accessToken();
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await ytError(res);
  const ch = (await res.json()).items?.[0];
  return ch ? { id: ch.id, title: ch.snippet.title, handle: ch.snippet.customUrl, subscribers: ch.statistics.subscriberCount } : null;
}

// Desktop OAuth flow on a loopback port; prints the refresh token for .env / GitHub Secrets.
async function authorize() {
  if (!process.env.YT_CLIENT_ID || !process.env.YT_CLIENT_SECRET) throw new Error("Set YT_CLIENT_ID and YT_CLIENT_SECRET in automation/.env first");
  const port = Number(process.env.YT_AUTH_PORT || 53682);
  const redirect = `http://127.0.0.1:${port}`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.YT_CLIENT_ID,
    redirect_uri: redirect,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  console.log(`Open this link, sign in with the account that owns the channel and pick the channel:\n\n${url}\n`);
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const q = new URL(req.url, redirect).searchParams;
      res.end(q.get("code") ? "Done. You can close this tab." : `Failed: ${q.get("error")}`);
      server.close();
      q.get("code") ? resolve(q.get("code")) : reject(new Error(q.get("error") || "no code"));
    });
    server.listen(port, "127.0.0.1");
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.YT_CLIENT_ID,
      client_secret: process.env.YT_CLIENT_SECRET,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!data.refresh_token) throw new Error(`No refresh token returned: ${data.error_description || data.error || res.status}`);
  // Saved straight into automation/.env so the token never lands in a terminal or log
  const envFile = path.join(ROOT, ".env");
  let env = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  const line = `YT_REFRESH_TOKEN=${data.refresh_token}`;
  env = /^YT_REFRESH_TOKEN=.*$/m.test(env) ? env.replace(/^YT_REFRESH_TOKEN=.*$/m, line) : `${env.replace(/\n?$/, "\n")}${line}\n`;
  fs.writeFileSync(envFile, env);
  process.env.YT_REFRESH_TOKEN = data.refresh_token;
  console.log("Saved YT_REFRESH_TOKEN to automation/.env.");
  console.log("Connected channel:", await channelInfo());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await import("./config.js");
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === "auth") await authorize();
    else if (cmd === "channel") console.log(await channelInfo());
    else if (cmd === "upload" && rest[0]) {
      const meta = shortsMetadata({ title: rest[1] || "Test upload", description: rest[2] || "", privacy: "private" });
      console.log(await uploadShort(rest[0], meta));
    } else console.log("Usage: node lib/youtube.js auth | channel | upload <file.mp4> <title> [description]");
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
