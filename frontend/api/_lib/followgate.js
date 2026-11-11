// Comment → DM with a follow check, on Instagram's own messaging API (no paid tools).
// 1. Someone comments a keyword: one private reply (Instagram allows one per comment, within
//    7 days) asks them to follow and reply DONE. The public reply tells them to check their DMs.
// 2. They reply in the DM: is_user_follow_business decides. Followers get the post's apply
//    links; others are asked to follow first. If the check itself fails, they get the links.
//    The reply is read by the webhook, and by the 10-minute sync when the webhook didn't get it.
// DM_FOLLOW_GATE=off sends the links in the first DM instead.
// Instagram only delivers these to the public once the app has Advanced Access for
// instagram_manage_messages and "Allow access to messages" is on in the Instagram app.

import { igRequest, sendPrivateReply, sendDirectMessage, listThreadMessages } from "./instagram.js";
import { readTab, appendRow, updateRow, ensureTab, ensureColumns, nowInZone } from "./sheets.js";
import { buildLinksMessage, COMMENTS_LOG_TAB, COMMENTS_LOG_HEADERS } from "./replies.js";

const HANDLE = "@beyond_the.offer";
export const FOLLOW_PROMPT =
  `Hey! The apply links for this post are ready.\n\nFollow ${HANDLE}, then tap DONE (or reply DONE) here and I'll send them.`;
const NOT_FOLLOWING =
  `I can't see your follow yet. Follow ${HANDLE}, then tap DONE again and the links are yours.`;
const PROFILE_URL = "https://www.instagram.com/beyond_the.offer";
// A tap arrives as a postback with this payload (webhook), and as a "DONE" message in the thread
export const DONE_PAYLOAD = "FOLLOW_DONE";
const DONE_BUTTON = { title: "DONE", payload: DONE_PAYLOAD };
// Replies that mean "send them now"
const DONE = /^\s*(done|yes|yep|ok(ay)?|followed|following|send|sent|link|links|job|jobs)\b/i;
const WAITING = "dm: waiting for follow";

const gateOn = () => !/^(off|false|0|no)$/i.test(String(process.env.DM_FOLLOW_GATE || "").trim());

export async function prepareCommentsLog() {
  await ensureTab(COMMENTS_LOG_TAB, COMMENTS_LOG_HEADERS);
  return ensureColumns(COMMENTS_LOG_TAB, COMMENTS_LOG_HEADERS);
}

// Sends the first DM for a keyword comment. Returns { ok, status, recipientId, error }.
export async function startCommentDm({ commentId, items, websiteUrl, postId }) {
  const gated = gateOn();
  try {
    if (!gated) {
      const res = await sendPrivateReply(commentId, buildLinksMessage(items, websiteUrl, postId));
      return { ok: true, status: "dm sent", recipientId: res.recipient_id || "" };
    }
    // DONE button attached under the message; a chip, then plain text, if Instagram refuses it
    const res = await sendPrivateReply(commentId, FOLLOW_PROMPT, { buttons: [DONE_BUTTON] })
      .catch(() => sendPrivateReply(commentId, FOLLOW_PROMPT, { quickReplies: ["DONE"] }))
      .catch(() => sendPrivateReply(commentId, FOLLOW_PROMPT));
    return { ok: true, status: WAITING, recipientId: res.recipient_id || "" };
  } catch (err) {
    return { ok: false, status: "", recipientId: "", error: err.message.slice(0, 200) };
  }
}

export async function followsUs(igsid) {
  const d = await igRequest(igsid, { params: { fields: "is_user_follow_business" } });
  return d.is_user_follow_business === true;
}

// Apply links for a Content_Queue row: Item_IDs → data tabs.
export async function itemsForRow(row) {
  const ids = new Set((row?.Item_IDs || "").split(/[,\s]+/).filter(Boolean));
  if (!ids.size) return [];

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
  return items;
}

async function itemsForPost(postId) {
  const { rows: queue } = await readTab("Content_Queue");
  return itemsForRow(queue.find((r) => r.ID === postId));
}

// Someone we asked to follow said DONE: check the follow, then send the links or ask again.
// `waiting` is every Comments_Log row still waiting for that person.
async function answerDone(senderId, waiting, headers, websiteUrl) {
  let follows = true;
  try {
    follows = await followsUs(senderId);
  } catch {
    // Can't check: don't hold the links back
  }
  if (!follows) {
    await sendDirectMessage(senderId, NOT_FOLLOWING, { buttons: [{ title: "Follow", url: PROFILE_URL }, DONE_BUTTON] })
      .catch(() => sendDirectMessage(senderId, NOT_FOLLOWING));
    return "asked again";
  }
  const postId = waiting[waiting.length - 1].Post_ID;
  const items = await itemsForPost(postId).catch(() => []);
  await sendDirectMessage(senderId, buildLinksMessage(items, websiteUrl, postId));
  const { date, time } = nowInZone();
  for (const row of waiting) {
    await updateRow(COMMENTS_LOG_TAB, headers, row._row, {
      Status: "dm sent",
      Reply_Text: `${date} ${time} links sent after follow`,
    }, { raw: true });
  }
  return "links sent";
}

// A DM from someone we asked to follow (webhook). Returns true when it was part of the follow flow.
export async function handleFollowReply({ senderId, text, websiteUrl }) {
  if (!DONE.test(text || "")) return false;
  const headers = await prepareCommentsLog();
  const { rows } = await readTab(COMMENTS_LOG_TAB);
  const waiting = rows.filter((r) => r.IG_Scoped_ID === senderId && r.Status === WAITING);
  if (!waiting.length) return false;
  await answerDone(senderId, waiting, headers, websiteUrl);
  return true;
}

// Same thing without the webhook, for the 10-minute sync: read each waiting thread and answer
// when the newest message is their DONE (after our answer the newest message is ours, so
// nobody is answered twice).
export async function sweepFollowReplies({ websiteUrl }) {
  const headers = await prepareCommentsLog();
  const { rows } = await readTab(COMMENTS_LOG_TAB);
  const bySender = new Map();
  for (const r of rows) {
    if (r.Status !== WAITING || !r.IG_Scoped_ID) continue;
    bySender.set(r.IG_Scoped_ID, [...(bySender.get(r.IG_Scoped_ID) || []), r]);
  }
  const result = { waiting: bySender.size, linksSent: 0, askedAgain: 0, errors: [] };
  for (const [senderId, waiting] of bySender) {
    try {
      const [newest] = await listThreadMessages(senderId, 1);
      if (newest?.from?.id !== senderId || !DONE.test(newest.message || "")) continue;
      const outcome = await answerDone(senderId, waiting, headers, websiteUrl);
      if (outcome === "links sent") result.linksSent += 1;
      else result.askedAgain += 1;
    } catch (err) {
      result.errors.push(err.message.slice(0, 200));
    }
  }
  return result;
}

export async function appendCommentLog(entry) {
  const headers = await prepareCommentsLog();
  return appendRow(COMMENTS_LOG_TAB, headers, entry);
}
