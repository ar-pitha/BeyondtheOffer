// Comment → DM with a follow check, on Instagram's own messaging API (no paid tools).
// 1. Someone comments a keyword: one private reply (Instagram allows one per comment, within
//    7 days) asks them to follow and reply DONE. The public reply tells them to check their DMs.
// 2. They reply in the DM: is_user_follow_business decides. Followers get the post's apply
//    links; others are asked to follow first. If the check itself fails, they get the links.
// DM_FOLLOW_GATE=off sends the links in the first DM instead.
// Instagram only delivers these to the public once the app has Advanced Access for
// instagram_manage_messages and "Allow access to messages" is on in the Instagram app.

import { igRequest, sendPrivateReply, sendDirectMessage } from "./instagram.js";
import { readTab, appendRow, updateRow, ensureTab, ensureColumns, nowInZone } from "./sheets.js";
import { buildLinksMessage, COMMENTS_LOG_TAB, COMMENTS_LOG_HEADERS } from "./replies.js";

const HANDLE = "@beyond_the.offer";
export const FOLLOW_PROMPT =
  `Hey! The apply links for this post are ready.\n\nFollow ${HANDLE}, then reply DONE here and I'll send them right away.`;
const NOT_FOLLOWING =
  `I can't see your follow yet. Follow ${HANDLE}, then reply DONE again and the links are yours.`;
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
    const res = await sendPrivateReply(commentId, gated ? FOLLOW_PROMPT : buildLinksMessage(items, websiteUrl, postId));
    return { ok: true, status: gated ? WAITING : "dm sent", recipientId: res.recipient_id || "" };
  } catch (err) {
    return { ok: false, status: "", recipientId: "", error: err.message.slice(0, 200) };
  }
}

export async function followsUs(igsid) {
  const d = await igRequest(igsid, { params: { fields: "is_user_follow_business" } });
  return d.is_user_follow_business === true;
}

// A DM from someone we asked to follow. Returns true when it was part of the follow flow.
export async function handleFollowReply({ senderId, text, websiteUrl, itemsForPost }) {
  if (!DONE.test(text || "")) return false;
  const headers = await prepareCommentsLog();
  const { rows } = await readTab(COMMENTS_LOG_TAB);
  const pending = rows.filter((r) => r.IG_Scoped_ID === senderId && r.Status === WAITING).pop();
  if (!pending) return false;

  let follows = true;
  try {
    follows = await followsUs(senderId);
  } catch {
    // Can't check: don't hold the links back
  }
  if (!follows) {
    await sendDirectMessage(senderId, NOT_FOLLOWING);
    return true;
  }
  const items = await itemsForPost(pending.Post_ID).catch(() => []);
  const message = buildLinksMessage(items, websiteUrl, pending.Post_ID);
  await sendDirectMessage(senderId, message);
  const { date, time } = nowInZone();
  await updateRow(COMMENTS_LOG_TAB, headers, pending._row, {
    Status: "dm sent",
    Reply_Text: `${date} ${time} links sent after follow`,
  }, { raw: true });
  return true;
}

export async function appendCommentLog(entry) {
  const headers = await prepareCommentsLog();
  return appendRow(COMMENTS_LOG_TAB, headers, entry);
}
