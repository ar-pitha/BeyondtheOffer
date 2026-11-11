// Instagram webhook (Vercel serverless function, Node runtime).
// GET  → Meta verification handshake
// POST → comments and messages events, signed with X-Hub-Signature-256
//
// Server-side env only (never VITE_): IG_WEBHOOK_VERIFY_TOKEN, IG_APP_SECRET,
// IG_ACCESS_TOKEN, IG_USER_ID, SHEET_ID, GOOGLE_SA_JSON_B64, WEBSITE_URL,
// optional ANTHROPIC_API_KEY (AI answers to questions) and AI_REPLY_MODE=draft (log only).

import crypto from "node:crypto";
import { readTab, appendRow, updateRow, nowInZone } from "./_lib/sheets.js";
import {
  getMedia,
  replyToComment,
  sendDirectMessage,
  permalinkKey,
} from "./_lib/instagram.js";
import {
  classifyComment,
  buildPublicLinksReply,
  PUBLIC_LINKS_REPLY,
  draftAnswer,
  COMMENTS_LOG_TAB,
} from "./_lib/replies.js";
import { startCommentDm, handleFollowReply, prepareCommentsLog, itemsForRow } from "./_lib/followgate.js";

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
  const headers = await prepareCommentsLog();
  const { date, time } = nowInZone();
  const result = await appendRow(COMMENTS_LOG_TAB, headers, { Time_IST: `${date} ${time}`, ...entry });
  const match = result.updates?.updatedRange?.match(/![A-Z]+(\d+)(?::|$)/);
  return match ? Number(match[1]) : null;
}

async function updateComment(rowNumber, entry) {
  if (!rowNumber) return logComment(entry);
  await updateRow(COMMENTS_LOG_TAB, await prepareCommentsLog(), rowNumber, entry, { raw: true });
}

async function alreadyHandled(commentId) {
  try {
    const { rows } = await readTab(COMMENTS_LOG_TAB);
    return rows.some((r) =>
      r.Comment_ID === commentId &&
      ["sent", "partial", "draft", "skipped", "needs review", "dm sent", "dm: waiting for follow"].includes(r.Status)
    );
  } catch {
    return false; // tab does not exist yet
  }
}

// Apply links for a post: permalink → Content_Queue row → items.
async function linksForMedia(mediaId) {
  const media = await getMedia(mediaId, "permalink,caption");
  const key = permalinkKey(media.permalink);
  const { rows: queue } = await readTab("Content_Queue");
  const row = queue.find((r) => r.IG_Post_Link && permalinkKey(r.IG_Post_Link) === key);
  return { items: await itemsForRow(row), caption: media.caption, postId: row?.ID };
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
  let logRow = null;
  try {
    logRow = await logComment({ ...base, Action: "received", Reply_Text: "", Status: "processing" });
  } catch {
    // Continue the reply attempt; the final error path below still tries to log.
  }
  const finishLog = (entry) => updateComment(logRow, { ...base, ...entry });

  try {
    if (action === "links") {
      const { items, postId } = await linksForMedia(mediaId);
      // DM first; the public reply points to it, or carries the links page when the DM failed
      const dm = await startCommentDm({ commentId, items, websiteUrl: WEBSITE_URL, postId });
      const publicReply = dm.ok ? PUBLIC_LINKS_REPLY : buildPublicLinksReply(items, WEBSITE_URL, postId);
      let publicError = "";
      try {
        await replyToComment(commentId, publicReply);
      } catch (error) {
        publicError = error.message.slice(0, 300);
      }
      if (publicError && !dm.ok) throw new Error(`Public reply failed: ${publicError}; DM failed: ${dm.error}`);
      await finishLog({
        Action: "links",
        Reply_Text: dm.ok ? publicReply : `${publicReply} (DM failed: ${dm.error})`,
        Status: dm.ok ? dm.status : "partial",
        IG_Scoped_ID: dm.recipientId,
        Post_ID: postId || "",
      });
    } else if (action === "thanks") {
      const { items, postId } = await linksForMedia(mediaId);
      let publicError = "";
      const publicReply = buildPublicLinksReply(items, WEBSITE_URL, postId);
      try {
        await replyToComment(commentId, publicReply);
      } catch (error) {
        publicError = error.message.slice(0, 300);
      }
      if (publicError) throw new Error(`Public reply failed: ${publicError}`);
      await finishLog({
        Action: "links",
        Reply_Text: publicReply,
        Status: "sent",
      });
    } else if (action === "question" && process.env.ANTHROPIC_API_KEY) {
      const { caption } = await getMedia(mediaId, "caption");
      const answer = await draftAnswer({ question: text, caption, websiteUrl: WEBSITE_URL });
      if (answer && process.env.AI_REPLY_MODE !== "draft") {
        await replyToComment(commentId, answer);
        await finishLog({ Action: "ai-answer", Reply_Text: answer, Status: "sent" });
      } else {
        await finishLog({ Action: "ai-answer", Reply_Text: answer || "", Status: "draft" });
      }
    } else if (action === "review") {
      await finishLog({ Action: `review: ${reason}`, Reply_Text: "", Status: "needs review" });
    } else {
      await finishLog({ Action: action === "question" ? "question" : "none", Reply_Text: "", Status: "skipped" });
    }
  } catch (err) {
    await finishLog({ Action: action, Reply_Text: err.message.slice(0, 300), Status: "error" }).catch(() => {});
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

  // "DONE" after a comment: check the follow and send that post's links
  const followFlow = await handleFollowReply({ senderId: event.sender.id, text: msg.text, websiteUrl: WEBSITE_URL });
  if (followFlow) return;

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
