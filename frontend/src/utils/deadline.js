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
