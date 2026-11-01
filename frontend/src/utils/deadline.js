// Whole days from today until the deadline (0 = closes today, negative = closed)
export function daysUntil(deadline) {
  if (!deadline) return null;
  const end = new Date(deadline);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(end);
  day.setHours(0, 0, 0, 0);
  return Math.round((day - today) / 86_400_000);
}

export const formatDate = (date, opts = { day: "numeric", month: "short" }) =>
  date ? new Date(date).toLocaleDateString("en-IN", opts) : "";


// Text and colour for the deadline pill on cards: { text, tone }
// tone: urgent (≤3 days), soon (≤7), later, open (no deadline), closed
export function pillFor(deadline) {
  const n = daysUntil(deadline);
  if (n === null) return { text: "Open now", tone: "open" };
  if (n < 0) return { text: "Closed", tone: "closed" };
  if (n === 0) return { text: "Last day today", tone: "urgent" };
  if (n === 1) return { text: "1 day left", tone: "urgent" };
  if (n <= 45) return { text: `${n} days left`, tone: n <= 3 ? "urgent" : n <= 7 ? "soon" : "later" };
  return { text: `Closes ${formatDate(deadline)}`, tone: "later" };
}
