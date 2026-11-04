// Which daily category a Content_Queue row belongs to (tech, news, govt, events, ai).
// Shared by publish.js (rotation, hashtags) and reels.js (each category has its own look).
export function categoryForRow(row) {
  const text = `${row.Title || ""} ${row.Slides_or_Script || ""} ${row.Hashtags || ""}`.toLowerCase();
  const ids = String(row.Item_IDs || "").toUpperCase();
  if (ids.split(/[,\s]+/).some((id) => id.startsWith("GJ-")) || /\b(government|govt|ssc|upsc|banking)\b/.test(text)) return "govt";
  if (ids.split(/[,\s]+/).some((id) => id.startsWith("HQ-")) || /\b(hackathon|quiz|ctf|contest)\b/.test(text)) return "events";
  if (ids.split(/[,\s]+/).some((id) => id.startsWith("TN-"))) return /\b(ai|artificial intelligence|machine learning|llm|model)\b/.test(text) ? "ai" : "news";
  return "tech";
}
