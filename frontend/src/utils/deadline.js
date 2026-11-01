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

// Text for the ticket stub: { big, small, tone }
export function stubFor(deadline) {
  const n = daysUntil(deadline);
  if (n === null) return { big: "Open", small: "no deadline", tone: "open" };
  if (n < 0) return { big: "Closed", small: formatDate(deadline), tone: "closed" };
  if (n === 0) return { big: "Today", small: "last day", tone: "urgent" };
  if (n <= 45) return { big: String(n), small: n === 1 ? "day left" : "days left", tone: n <= 3 ? "urgent" : n <= 7 ? "soon" : "later" };
  return { big: formatDate(deadline), small: "closes", tone: "open" };
}

export const isOpen = (item) => item.isActive !== false && (daysUntil(item.deadline) ?? 0) >= 0;
