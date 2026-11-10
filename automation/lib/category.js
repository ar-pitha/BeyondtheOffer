// Which daily category a Content_Queue row belongs to (tech, news, govt, events, ai).
// Shared by publish.js (rotation, hashtags) and reels.js (each category has its own look).
export function categoryForRow(row) {
  const text = `${row.Title || ""} ${row.Slides_or_Script || ""} ${row.Hashtags || ""}`.toLowerCase();
  const ids = String(row.Item_IDs || "").toUpperCase().split(/[,\s]+/).filter(Boolean);
  const has = (prefix) => ids.some((id) => id.startsWith(prefix));
  const news = () => (/\b(ai|artificial intelligence|machine learning|llm|model)\b/.test(text) ? "ai" : "news");
  // A row built only from news items is news, even when a story mentions a hackathon or a contest
  if (ids.length && ids.every((id) => id.startsWith("TN-"))) return news();
  if (has("GJ-") || /\b(government|govt|ssc|upsc|banking)\b/.test(text)) return "govt";
  if (has("HQ-") || /\b(hackathon|quiz|ctf|contest)\b/.test(text)) return "events";
  if (has("TN-")) return news();
  return "tech";
}
