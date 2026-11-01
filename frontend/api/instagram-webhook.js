// Instagram webhook (Vercel serverless function, Node runtime).
// GET  → Meta verification handshake
// POST → comments and messages events, signed with X-Hub-Signature-256
//
// Server-side env only (never VITE_): IG_WEBHOOK_VERIFY_TOKEN, IG_APP_SECRET,
// IG_ACCESS_TOKEN, IG_USER_ID, SHEET_ID, GOOGLE_SA_JSON_B64, WEBSITE_URL,
// optional ANTHROPIC_API_KEY (AI answers to questions) and AI_REPLY_MODE=draft (log only).

import crypto from "node:crypto";
import { readTab, appendRow, ensureTab, nowInZone } from "./_lib/sheets.js";
import {
  getMedia,
  replyToComment,
  sendPrivateReply,
  sendDirectMessage,
  permalinkKey,
} from "./_lib/instagram.js";
import {
  classifyComment,
  thanksReply,
  buildLinksMessage,
  draftAnswer,
  PUBLIC_LINKS_REPLY,
  COMMENTS_LOG_TAB,
  COMMENTS_LOG_HEADERS,
} from "./_lib/replies.js";

const WEBSITE_URL = process.env.WEBSITE_URL || "https://beyondtheoffer.vercel.app";
const TIME_BUDGET_MS = 8000;

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(typeof c === "string" ? Buffer.from(c) : c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function validSignature(raw, header) {
  const secret = process.env.IG_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`);
  const got = Buffer.from(header);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

async function logComment(entry) {
  await ensureTab(COMMENTS_LOG_TAB, COMMENTS_LOG_HEADERS);
  const { date, time } = nowInZone();
  await appendRow(COMMENTS_LOG_TAB, COMMENTS_LOG_HEADERS, { Time_IST: `${date} ${time}`, ...entry });
}

async function alreadyHandled(commentId) {
  try {
    const { rows } = await readTab(COMMENTS_LOG_TAB);
    return rows.some((r) => r.Comment_ID === commentId && r.Status !== "error");
  } catch {
    return false; // tab does not exist yet
  }
}

// Apply links for a post: permalink → Content_Queue row → Item_IDs → data tabs.
async function linksForMedia(mediaId) {
  const media = await getMedia(mediaId, "permalink,caption");
  const key = permalinkKey(media.permalink);
  const { rows: queue } = await readTab("Content_Queue");
  const row = queue.find((r) => r.IG_Post_Link && permalinkKey(r.IG_Post_Link) === key);
  const ids = new Set((row?.Item_IDs || "").split(/[,\s]+/).filter(Boolean));
  if (!ids.size) return { items: [], caption: media.caption, postId: row?.ID };

  const tabs = [
    ["Tech_Jobs", (r) => [`${r.Role}, ${r.Company}`, r.Apply_Link]],
    ["Govt_Jobs", (r) => [`${r.Post_Exam}, ${r.Organisation}`, r.Official_Link || r.Notification_Link]],
    ["Hackathons_Quizzes", (r) => [r.Name, r.Link]],
    ["Tech_News", (r) => [r.Headline, r.Link]],
  ];
  const items = [];
  for (const [tab, pick] of tabs) {
    if (items.length === ids.size) break;
    const { rows } = await readTab(tab).catch(() => ({ rows: [] }));
    for (const r of rows) {
      if (!ids.has(r.ID)) continue;
      const [label, link] = pick(r);
      items.push({ label, link });
    }
  }
  return { items, caption: media.caption, postId: row.ID };
}

async function handleComment(value) {
  const commentId = value.id;
  const text = value.text || "";
  const username = value.from?.username || "";
  const mediaId = value.media?.id || "";
  const base = { Comment_ID: commentId, Media_ID: mediaId, Username: username, Text: text.slice(0, 500) };

  // Never answer ourselves (our replies come back as comment events too)
  if (value.from?.id === process.env.IG_USER_ID) return;
  if (await alreadyHandled(commentId)) return;

  const { action, reason } = classifyComment(text);
  try {
    if (action === "links") {
      const { items, postId } = await linksForMedia(mediaId);
      const dm = buildLinksMessage(items, WEBSITE_URL, postId);
      await sendPrivateReply(commentId, dm);
      await replyToComment(commentId, PUBLIC_LINKS_REPLY);
      await logComment({ ...base, Action: "links", Reply_Text: `${PUBLIC_LINKS_REPLY} | DM: ${items.length} link(s)`, Status: "sent" });
    } else if (action === "thanks") {
      const reply = thanksReply(commentId);
      await replyToComment(commentId, reply);
      await logComment({ ...base, Action: "thanks", Reply_Text: reply, Status: "sent" });
    } else if (action === "question" && process.env.ANTHROPIC_API_KEY) {
      const { caption } = await getMedia(mediaId, "caption");
      const answer = await draftAnswer({ question: text, caption, websiteUrl: WEBSITE_URL });
      if (answer && process.env.AI_REPLY_MODE !== "draft") {
        await replyToComment(commentId, answer);
        await logComment({ ...base, Action: "ai-answer", Reply_Text: answer, Status: "sent" });
      } else {
        await logComment({ ...base, Action: "ai-answer", Reply_Text: answer || "", Status: "draft" });
      }
    } else if (action === "review") {
      await logComment({ ...base, Action: `review: ${reason}`, Reply_Text: "", Status: "needs review" });
    } else {
      await logComment({ ...base, Action: action === "question" ? "question" : "none", Reply_Text: "", Status: "skipped" });
    }
  } catch (err) {
    await logComment({ ...base, Action: action, Reply_Text: err.message.slice(0, 300), Status: "error" }).catch(() => {});
  }
}

// DMs: anyone who messages a keyword gets the website link.
const DELETE_REQUEST = /\b(delete|remove|erase)\s+(my\s+)?(data|info|information|details)\b/i;

async function handleMessage(event) {
  const msg = event.message;
  if (!msg?.text || msg.is_echo || event.sender?.id === process.env.IG_USER_ID) return;

  // Data deletion requests (promised on /data-deletion): log for the team, confirm to the person
  if (DELETE_REQUEST.test(msg.text)) {
    const reply =
      "Got it. We'll delete every comment log linked to your account within 30 days and confirm here. " +
      `Details: ${WEBSITE_URL}/data-deletion`;
    await sendDirectMessage(event.sender.id, reply);
    await logComment({
      Comment_ID: msg.mid || "",
      Media_ID: "",
      Username: `ig-scoped:${event.sender.id}`,
      Text: msg.text.slice(0, 500),
      Action: "deletion request",
      Reply_Text: reply,
      Status: "needs review",
    });
    return;
  }

  if (classifyComment(msg.text).action !== "links") return;
  await sendDirectMessage(
    event.sender.id,
    `Every opening with its apply link is here, updated daily: ${WEBSITE_URL}\n\nTip: comment JOB under any post and we'll DM you that post's links.`
  );
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const q = req.query || Object.fromEntries(new URL(req.url, "http://x").searchParams);
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === process.env.IG_WEBHOOK_VERIFY_TOKEN) {
      res.statusCode = 200;
      return res.end(String(q["hub.challenge"] ?? ""));
    }
    res.statusCode = 403;
    return res.end("Verification failed");
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  const raw = await readRawBody(req);
  if (!validSignature(raw, req.headers["x-hub-signature-256"])) {
    res.statusCode = 401;
    return res.end("Bad signature");
  }

  let body;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    res.statusCode = 400;
    return res.end("Bad JSON");
  }

  const jobs = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === "comments" && change.value) jobs.push(handleComment(change.value));
    }
    for (const event of entry.messaging || []) jobs.push(handleMessage(event));
  }

  // Vercel stops the function once we respond, so do the work first, within a time budget.
  // Meta retries undelivered events; Comments_Log makes retries harmless.
  await Promise.race([
    Promise.allSettled(jobs),
    new Promise((resolve) => setTimeout(resolve, TIME_BUDGET_MS)),
  ]);
  res.statusCode = 200;
  res.end("EVENT_RECEIVED");
}

// Keep Vercel from consuming the body before we verify the signature.
export const config = { api: { bodyParser: false } };
