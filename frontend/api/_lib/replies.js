// Comment reply rules shared by the webhook (frontend/api) and automation/lib/replies.js.

const LINK_WORDS = /\b(job|jobs|intern|internship|internships|link|links|ai)\b/i;
const QUESTION_START = /^(what|how|when|where|which|who|why|is|are|can|could|does|do|will|should|any)\b/i;
const THANKS = /\b(thanks?|thank you|thx|tysm|ty|helpful|nice|great|awesome|super|amazing|useful|good one|love (it|this))\b/i;

// Comments we never answer automatically; they go to Comments_Log for manual review.
const RUDE = /\b(fuck|shit|bitch|bastard|idiot|stupid|chutiya|madarchod|bhenchod|harami|scam|fraud|fake)\b/i;
const SPAM = /(https?:\/\/|www\.|follow (me|back)|check (my|out my) (page|profile)|dm me for|earn \d+|crypto|forex|bitcoin|promo(tion)?|giveaway)/i;
const POLITICAL = /\b(bjp|congress|aap|modi|rahul gandhi|election|vote for|reservation|caste)\b/i;
const PERSONAL = /(\b\d{10}\b|\+91[\s-]?\d{5}[\s-]?\d{5}|[\w.+-]+@[\w-]+\.[\w.]+)/i;

const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}\s]+$/u;

export const COMMENTS_LOG_TAB = "Comments_Log";
export const COMMENTS_LOG_HEADERS = [
  "Time_IST",
  "Comment_ID",
  "Media_ID",
  "Username",
  "Text",
  "Action",
  "Reply_Text",
  "Status",
  // Set when a comment starts the DM flow (_lib/followgate.js): who to DM and for which post
  "IG_Scoped_ID",
  "Post_ID",
];

// Returns { action, reason }.
// action: "links" | "thanks" | "question" | "review" | "ignore"
export function classifyComment(text = "") {
  const t = String(text).trim();
  if (!t) return { action: "ignore", reason: "empty" };
  if (RUDE.test(t)) return { action: "review", reason: "rude" };
  if (SPAM.test(t)) return { action: "review", reason: "spam" };
  if (POLITICAL.test(t)) return { action: "review", reason: "political" };
  if (PERSONAL.test(t)) return { action: "review", reason: "personal details" };
  if (LINK_WORDS.test(t)) return { action: "links", reason: "keyword" };
  if (EMOJI_ONLY.test(t) || (THANKS.test(t) && !t.includes("?"))) return { action: "thanks", reason: "thanks" };
  if (t.includes("?") || QUESTION_START.test(t)) return { action: "question", reason: "question" };
  return { action: "ignore", reason: "no rule" };
}

const THANK_REPLIES = [
  "Glad it helps! New openings drop every day.",
  "Thank you! Share it with a friend who's applying.",
  "Happy to help! Follow for daily jobs and hackathons.",
  "Thanks! All the links are on our website too, link in bio.",
];

export function thanksReply(seed = "") {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return THANK_REPLIES[h % THANK_REPLIES.length];
}

export const PUBLIC_LINKS_REPLY = "Thanks for your comment, please check your DM!";

function utf8Size(text) {
  return new TextEncoder().encode(text).length;
}

function fitUtf8(text, maxBytes) {
  let end = text.length;
  while (end > 0 && utf8Size(text.slice(0, end)) > maxBytes) end -= 1;
  return text.slice(0, end);
}

// DM text with apply links. Instagram caps message text at 1000 UTF-8 bytes.
export function buildLinksMessage(items, websiteUrl, postId) {
  const site = websiteUrl || "https://beyondtheoffer.vercel.app";
  const lines = ["Here are the links from our post:", ""];
  if (postId) lines.push(`All in one page: ${site}/links/${postId}`, "");
  for (const item of items) {
    if (!item.link) continue;
    lines.push(`• ${item.label}`, `  ${item.link}`);
  }
  if (lines.length === 2) lines.push("Every opening with its apply link is on our website:");
  lines.push("", `More openings, updated daily: ${site}`);

  let text = lines.join("\n");
  if (utf8Size(text) > 1000) {
    const fallback = `\n\nFull list: ${site}`;
    text = `${fitUtf8(text, 1000 - utf8Size(fallback)).replace(/\n[^\n]*$/, "")}${fallback}`;
  }
  return text;
}

// Short answer drafted by Claude using only the post caption and the website link.
export async function draftAnswer({ question, caption, websiteUrl }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 160,
      system:
        "You reply to Instagram comments for @beyond_the.offer, a page that shares jobs, internships, " +
        "government notifications and hackathons for Indian students and freshers. Reply in at most two short, " +
        "friendly sentences. Use only facts from the post caption below and the website link. If the caption does " +
        "not answer the question, point them to the website. Never invent dates, salaries, eligibility or links. " +
        "Reply with the comment text only.",
      messages: [
        {
          role: "user",
          content: `Post caption:\n${caption || "(no caption)"}\n\nWebsite: ${websiteUrl}\n\nComment:\n${question}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
  return text ? text.slice(0, 300) : null;
}
