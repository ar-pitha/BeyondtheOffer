// Instagram Graph API (Instagram Login) helpers shared by the webhook and automation/.

const base = () => {
  const loginType = process.env.IG_LOGIN_TYPE || "unified";
  return loginType === "unified"
    ? "https://graph.facebook.com"
    : process.env.IG_API_BASE || "https://graph.instagram.com";
};
const version = () => process.env.IG_API_VERSION || "v26.0";

export async function igRequest(path, { method = "GET", params = {}, json, context = {} } = {}) {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error("IG_ACCESS_TOKEN is not set");

  const url = new URL(`${base()}/${version()}/${path.replace(/^\//, "")}`);
  const query = method === "GET" || json ? params : {};
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const init = { method, headers: { Authorization: `Bearer ${token}` } };
  if (json) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  } else if (method !== "GET") {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null))
    );
  }

  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    const details = [
      `HTTP ${res.status}`,
      e.message || "error",
      e.code ? `code ${e.code}` : "",
      e.error_subcode ? `subcode ${e.error_subcode}` : "",
      e.fbtrace_id ? `fbtrace_id ${e.fbtrace_id}` : "",
      context.commentId ? `comment_id ${context.commentId}` : "",
      process.env.IG_USER_ID ? `ig_user_id ${process.env.IG_USER_ID}` : "",
    ].filter(Boolean).join("; ");
    const err = new Error(
      `Instagram ${method} ${path} → ${details}`
    );
    err.code = e.code;
    err.subcode = e.error_subcode;
    err.fbtraceId = e.fbtrace_id;
    err.commentId = context.commentId;
    throw err;
  }
  return data;
}

export const igUserId = () => {
  if (!process.env.IG_USER_ID) throw new Error("IG_USER_ID is not set");
  return process.env.IG_USER_ID;
};

export const getMedia = (mediaId, fields = "id,caption,permalink,media_type,timestamp") =>
  igRequest(mediaId, { params: { fields } });

export const listUserMedia = (limit = 100) =>
  igRequest(`${igUserId()}/media`, {
    params: { fields: "id,permalink,caption", limit },
  });

export const listMediaComments = (mediaId) =>
  igRequest(`${mediaId}/comments`, {
    params: {
      fields: "id,text,username,from,timestamp,replies.limit(50){id,text,username,from,timestamp}",
      limit: 100,
    },
  });

// Public reply under a comment
export const replyToComment = (commentId, message) =>
  igRequest(`${commentId}/replies`, {
    method: "POST",
    params: { message },
    context: { commentId },
  });

// Private reply using the Unified Login Instagram messaging endpoint.
// buttons: attached under the message bubble. { title, url } opens a link; { title, payload }
//   comes back as a postback (webhook field messaging_postbacks).
// quickReplies: titles shown as chips above the keyboard; a tap sends the title back as a DM.
const messageBody = (text, { buttons = [], quickReplies = [] } = {}) => {
  if (buttons.length) {
    return {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text,
          buttons: buttons.map((b) =>
            b.url ? { type: "web_url", url: b.url, title: b.title } : { type: "postback", title: b.title, payload: b.payload }
          ),
        },
      },
    };
  }
  if (quickReplies.length) {
    return { text, quick_replies: quickReplies.map((title) => ({ content_type: "text", title, payload: title })) };
  }
  return { text };
};

export const sendPrivateReply = (commentId, text, extras) =>
  igRequest(`${igUserId()}/messages`, {
    method: "POST",
    json: { recipient: { comment_id: commentId }, message: messageBody(text, extras) },
    context: { commentId },
  });

// Newest-first messages of our DM thread with one person
export const listThreadMessages = async (userId, limit = 10) => {
  // The API ignores user_id here and returns every thread, so match on participants.
  // ponytail: looks at the 50 most recent threads only; page through if DMs outgrow that
  const d = await igRequest(`${igUserId()}/conversations`, {
    params: { platform: "instagram", limit: 50, fields: `participants,messages.limit(${limit}){from,created_time,message}` },
  });
  const thread = (d.data || []).find((c) => (c.participants?.data || []).some((p) => p.id === userId));
  return thread?.messages?.data || [];
};

// Normal DM inside an open conversation
export const sendDirectMessage = (userId, text, extras) =>
  igRequest(`${igUserId()}/messages`, {
    method: "POST",
    json: { recipient: { id: userId }, message: messageBody(text, extras) },
  });

// Permalinks differ by trailing slash and query string; compare on the shortcode.
export function permalinkKey(url = "") {
  const m = String(url).match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|tv)\/([^/?#]+)/i);
  return m ? m[1] : String(url).trim().replace(/[/?#].*$/, "");
}
