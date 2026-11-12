// Which Content_Queue posts can still go out. Shared by the admin panel (admin-sheet.js) and the
// publisher (automation/lib/post.js), so the panel never offers a post the publisher would refuse.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// Deadlines are end-of-day in IST (23:59:59 IST = 18:29:59 UTC).
const endOfDayIST = (y, m, d) => new Date(Date.UTC(y, m, d, 18, 29, 59));

// Accepts 2026-11-15, 15/11/2026, 15-11-2026, 15 Nov 2026, Nov 15, 2026.
// Returns null for blanks and words like "Rolling", "ASAP", "TBA".
export function parseSheetDate(value) {
  const s = String(value ?? "").trim();
  if (!s || /^(rolling|asap|tba|tbd|na|n\/a|-|open|ongoing|soon)$/i.test(s)) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return endOfDayIST(+m[1], +m[2] - 1, +m[3]);

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return endOfDayIST(y, +m[2] - 1, +m[1]);
  }

  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3})[a-z]*[\s,-]+(\d{4})$/i);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) return endOfDayIST(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);

  m = s.match(/^([a-z]{3})[a-z]*[\s-]+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if (m && MONTHS[m[1].toLowerCase()] !== undefined) return endOfDayIST(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);

  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

// Marked by publish.js once a post with this item goes out
export const alreadyPosted = (item) => item.Posted_On_IG === "Y" || item.Used_In_Post === "Y";

// Still open: not marked expired, and its last date (if any) hasn't passed
export function isOpen(item) {
  if (/expired|closed/i.test(item.Status || "")) return false;
  const date = parseSheetDate(item.Last_Date || item.Apply_By || item.Register_By || "");
  return !date || Number.isNaN(date.getTime()) || date.getTime() > Date.now();
}

// ponytail: news has no deadline, so news (and drafts with no sheet items) count as expired
// by age; change the number of days here
const STALE_DAYS = 7;
const stale = (value) => {
  const date = parseSheetDate(value);
  return !!date && Date.now() - date.getTime() > STALE_DAYS * 86_400_000;
};

const idsOf = (row) => String(row.Item_IDs || "").split(/[,\s]+/).filter(Boolean);

// { [post ID]: { state: "expired" | "duplicate", reason } } for posts that aren't out yet and
// must not be posted.
// - expired: every opening has closed (news: gone stale).
// - duplicate: every opening is already on Instagram, or the post shares an opening with
//   another post that isn't out yet. Among those an opening sits in one post only: approved
//   posts keep theirs, then the newest draft wins and older drafts sharing it are duplicates.
// An opening that is already on Instagram doesn't make a post a duplicate while the post has
// others left: the publisher leaves it off the slides.
export function queueStates(queue, itemsById) {
  const rank = { Published: 0, Approved: 1 };
  const order = queue
    .filter((r) => r.Status !== "Rejected")
    .sort((a, b) => (rank[a.Status] ?? 2) - (rank[b.Status] ?? 2) || b._row - a._row);
  const out = new Set(); // item IDs in published posts
  const owner = new Map(); // item ID → the unpublished post that keeps it
  const states = {};

  for (const row of order) {
    const ids = idsOf(row);
    if (row.Status === "Published") {
      ids.forEach((id) => out.add(id));
      continue;
    }
    const known = ids.map((id) => itemsById.get(id)).filter(Boolean);
    if (!known.length) {
      if (stale(row.Date)) states[row.ID] = { state: "expired", reason: `Drafted more than ${STALE_DAYS} days ago.` };
      continue;
    }
    const open = known.filter((i) => isOpen(i) && !(i.ID.startsWith("TN-") && stale(i.Date)));
    if (!open.length) {
      const news = known.every((i) => i.ID.startsWith("TN-"));
      states[row.ID] = { state: "expired", reason: news ? `Every story is more than ${STALE_DAYS} days old.` : "Every opening in this post has closed." };
      continue;
    }
    const fresh = open.filter((i) => !alreadyPosted(i) && !out.has(i.ID));
    if (!fresh.length) {
      states[row.ID] = { state: "duplicate", reason: "Every opening is already on Instagram." };
      continue;
    }
    const others = [...new Set(fresh.map((i) => owner.get(i.ID)).filter(Boolean))];
    if (others.length) {
      states[row.ID] = { state: "duplicate", reason: `Its openings are already in ${others.join(", ")}.` };
      continue;
    }
    fresh.forEach((i) => owner.set(i.ID, row.ID));
  }
  return states;
}

// Self-check: node frontend/api/_lib/queue.js
if (process.argv[1]?.replace(/\\/g, "/").endsWith("_lib/queue.js")) {
  const { default: assert } = await import("node:assert");
  const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const items = new Map(
    [
      { ID: "TJ-1", Apply_By: day(5) },
      { ID: "TJ-2", Apply_By: day(-1) },
      { ID: "TJ-3", Apply_By: day(5), Posted_On_IG: "Y" },
      { ID: "TJ-4", Apply_By: day(9) },
      { ID: "TN-1", Date: day(-10) },
    ].map((i) => [i.ID, i])
  );
  const queue = [
    { ID: "A", _row: 2, Status: "Published", Item_IDs: "TJ-3" },
    { ID: "B", _row: 3, Status: "Draft", Item_IDs: "TJ-1, TJ-2" }, // TJ-1 is in the newer D
    { ID: "C", _row: 4, Status: "Draft", Item_IDs: "TJ-2" }, // closed
    { ID: "D", _row: 5, Status: "Draft", Item_IDs: "TJ-1 TJ-3" }, // keeps TJ-1; TJ-3 is out, left off
    { ID: "E", _row: 6, Status: "Approved", Item_IDs: "TJ-4" },
    { ID: "F", _row: 7, Status: "Draft", Item_IDs: "TJ-4, TJ-1" }, // TJ-4 is in the approved E
    { ID: "G", _row: 8, Status: "Draft", Item_IDs: "TN-1" }, // old news
    { ID: "H", _row: 9, Status: "Rejected", Item_IDs: "TJ-1" },
    { ID: "I", _row: 10, Status: "Draft", Item_IDs: "", Date: day(0) },
    { ID: "J", _row: 11, Status: "Draft", Item_IDs: "TJ-3" }, // only an opening that is out
  ];
  const s = queueStates(queue, items);
  assert.deepStrictEqual(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.state])), {
    B: "duplicate", C: "expired", F: "duplicate", G: "expired", J: "duplicate",
  });
  assert.match(s.B.reason, /in D\./);
  assert.match(s.F.reason, /in E\./);
  console.log("queue.js ok");
}
