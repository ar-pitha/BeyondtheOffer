// One set of sort orders for every list. Newest first is the default everywhere.
export const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "updated", label: "Recently updated" },
  { value: "closing", label: "Closing soon" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "A to Z" },
];

export const isSort = (v) => SORTS.some((s) => s.value === v);

const time = (d) => {
  const t = d ? new Date(d).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

// Missing values always go last, whichever way the list runs.
const byTime = (get, dir) => (a, b) => {
  const x = time(get(a));
  const y = time(get(b));
  if (x === null || y === null) return (x === null) - (y === null);
  return dir * (x - y);
};

// Works on API docs and on useOpps rows alike.
export function sortItems(list, sort = "newest") {
  const items = [...list];
  switch (sort) {
    case "updated":
      return items.sort(byTime((o) => o.updatedAt || o.raw?.updatedAt || o.createdAt, -1));
    case "closing":
      // Past deadlines sink below open ones, then open-ended listings
      return items.sort(byTime((o) => (time(o.deadline) >= new Date().setHours(0, 0, 0, 0) ? o.deadline : null), 1));
    case "oldest":
      return items.sort(byTime((o) => o.createdAt, 1));
    case "az":
      return items.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    default:
      return items.sort(byTime((o) => o.createdAt, -1));
  }
}
