// Instagram Graph API (Instagram Login) helpers shared by the webhook and automation/.

const base = () => process.env.IG_API_BASE || "https://graph.instagram.com";
const version = () => process.env.IG_API_VERSION || "v21.0";

export async function igRequest(path, { method = "GET", params = {}, json } = {}) {
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
    const err = new Error(
      `Instagram ${method} ${path} → ${res.status}: ${e.message || "error"}` +
        (e.code ? ` (code ${e.code}${e.error_subcode ? `, subcode ${e.error_subcode}` : ""})` : "")
    );
    err.code = e.code;
    err.subcode = e.error_subcode;
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
  igRequest(`${commentId}/replies`, { method: "POST", params: { message } });

// Private reply: a DM sent to the person who wrote the comment
export const sendPrivateReply = (commentId, text) =>
  igRequest(`${igUserId()}/messages`, {
    method: "POST",
    json: { recipient: { comment_id: commentId }, message: { text } },
  });

// Normal DM inside an open conversation
export const sendDirectMessage = (userId, text) =>
  igRequest(`${igUserId()}/messages`, {
    method: "POST",
    json: { recipient: { id: userId }, message: { text } },
  });

// Permalinks differ by trailing slash and query string; compare on the shortcode.
export function permalinkKey(url = "") {
  const m = String(url).match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|tv)\/([^/?#]+)/i);
  return m ? m[1] : String(url).trim().replace(/[/?#].*$/, "");
}
