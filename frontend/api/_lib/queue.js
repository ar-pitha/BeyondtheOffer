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

// The website and the carousels only carry openings confirmed by the source or by two sources
export const TRUSTED = ["Official", "Multi-source"];

// Rejected in /admin/feed → Openings: never offered for a post again (the website still shows it)
export const igRejected = (item) => item.IG_Rejected === "Y";

// IDs of carousels grouped in /admin/feed (CQ-20261112-G1)
export const GROUPED = /-G\d+$/;

// Posts that hold openings: published and approved ones, and drafts grouped in the admin.
// Drafts written any other way (the daily task's) hold nothing and are never shown.
const holds = (r) => r.Status === "Published" || r.Status === "Approved" || ((r.Status || "Draft") === "Draft" && GROUPED.test(r.ID));

// The next carousel for one sheet tab: trusted openings that are open, not on Instagram and not
// in `taken`, fewest days left first (no closing date goes last, newest first), cut to `size`.
// One that closes within a day is skipped: it would be shut before most people see the post.
export function pickOpenings(rows, dateColumn, taken, size = 4) {
  const closes = (r) => parseSheetDate(r[dateColumn])?.getTime() ?? Infinity;
  const soonest = Date.now() + 86_400_000;
  return rows
    .filter((r) => r.ID && TRUSTED.includes(r.Verified) && isOpen(r) && closes(r) > soonest && !alreadyPosted(r) && !igRejected(r) && !taken.has(r.ID))
    .sort((a, b) => closes(a) - closes(b) || String(b.Date_Added || "").localeCompare(String(a.Date_Added || "")))
    .slice(0, size);
}

const idsOf = (row) => String(row.Item_IDs || "").split(/[,\s]+/).filter(Boolean);
const labelOf = (i) => String(i.Company || i.Organisation || i.Name || i.Headline || i.ID).replace(/\s*\([^)]*\)/g, "").trim();

// Plans every post that isn't out yet, one opening at a time:
//   { [post ID]: { keep: [item IDs], dropped: [{ id, label, why }], state?, reason? } }
// An opening is left off its carousel when it has closed, is already on Instagram, or another
// post that isn't out yet keeps it (approved posts first, then the newest draft). The rest of
// the carousel stays. state is set only when nothing is left to post: "expired" when every
// opening has closed, otherwise "duplicate". Tech news has no closing date and never expires.
// Only posts that hold openings (see holds) are planned.
export function planQueue(queue, itemsById) {
  const rank = { Published: 0, Approved: 1 };
  const order = queue
    .filter(holds)
    .sort((a, b) => (rank[a.Status] ?? 2) - (rank[b.Status] ?? 2) || b._row - a._row);
  const out = new Set(); // item IDs in published posts
  const owner = new Map(); // item ID → the unpublished post that keeps it
  const plan = {};

  for (const row of order) {
    const ids = idsOf(row);
    if (row.Status === "Published") {
      ids.forEach((id) => out.add(id));
      continue;
    }
    const known = ids.map((id) => itemsById.get(id)).filter(Boolean);
    const keep = [];
    const dropped = [];
    for (const i of known) {
      const why = !isOpen(i) ? "closed" : alreadyPosted(i) || out.has(i.ID) ? "already on Instagram" : owner.has(i.ID) ? `in ${owner.get(i.ID)}` : "";
      if (why) dropped.push({ id: i.ID, label: labelOf(i), why });
      else keep.push(i.ID);
    }
    keep.forEach((id) => owner.set(id, row.ID));
    plan[row.ID] = { keep, dropped };
    if (known.length && !keep.length) {
      const expired = dropped.every((d) => d.why === "closed");
      plan[row.ID].state = expired ? "expired" : "duplicate";
      plan[row.ID].reason = expired
        ? "Every opening in this post has closed."
        : "Every opening is closed, already on Instagram or in another post.";
    }
  }
  return plan;
}

// Self-check: node frontend/api/_lib/queue.js
if (process.argv[1]?.replace(/\\/g, "/").endsWith("_lib/queue.js")) {
  const { default: assert } = await import("node:assert");
  const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const items = new Map(
    [
      { ID: "TJ-1", Company: "Acme", Apply_By: day(5) },
      { ID: "TJ-2", Company: "Bolt", Apply_By: day(-1) },
      { ID: "TJ-3", Company: "Core", Apply_By: day(5), Posted_On_IG: "Y" },
      { ID: "TJ-4", Company: "Dune", Apply_By: day(9) },
      { ID: "TJ-5", Company: "Echo", Apply_By: day(9) },
      { ID: "TN-1", Headline: "Old story", Date: day(-30) },
    ].map((i) => [i.ID, i])
  );
  const queue = [
    { ID: "A", _row: 2, Status: "Published", Item_IDs: "TJ-3" },
    { ID: "B-G1", _row: 3, Status: "Draft", Item_IDs: "TJ-1, TJ-2, TJ-5" }, // keeps TJ-5 only
    { ID: "C-G1", _row: 4, Status: "Draft", Item_IDs: "TJ-2" }, // closed
    { ID: "D-G1", _row: 5, Status: "Draft", Item_IDs: "TJ-1 TJ-3" }, // newer than B: keeps TJ-1
    { ID: "E", _row: 6, Status: "Approved", Item_IDs: "TJ-4" },
    { ID: "F-G1", _row: 7, Status: "Draft", Item_IDs: "TJ-4, TJ-3" }, // TJ-4 is approved in E, TJ-3 is out
    { ID: "G-G1", _row: 8, Status: "Draft", Item_IDs: "TN-1" }, // news never expires
    { ID: "H-G1", _row: 9, Status: "Rejected", Item_IDs: "TJ-1" },
    { ID: "I-G1", _row: 10, Status: "Draft", Item_IDs: "" },
    { ID: "K", _row: 11, Status: "Draft", Item_IDs: "TJ-5" }, // a daily-task draft: holds nothing
  ];
  const p = planQueue(queue, items);
  assert.deepStrictEqual(Object.fromEntries(Object.entries(p).filter(([, v]) => v.state).map(([k, v]) => [k, v.state])), { "C-G1": "expired", "F-G1": "duplicate" });
  assert.deepStrictEqual(p["B-G1"].keep, ["TJ-5"]);
  assert.deepStrictEqual(p["B-G1"].dropped.map((d) => `${d.label}: ${d.why}`), ["Acme: in D-G1", "Bolt: closed"]);
  assert.deepStrictEqual(p["D-G1"].keep, ["TJ-1"]);
  assert.deepStrictEqual(p["G-G1"].keep, ["TN-1"]);
  assert.ok(!p["H-G1"] && !p.A && !p.K);

  const tab = [
    { ID: "X1", Verified: "Official", Apply_By: day(9) },
    { ID: "X2", Verified: "Single-source", Apply_By: day(1) }, // not trusted
    { ID: "X3", Verified: "Multi-source", Apply_By: day(2) },
    { ID: "X9", Verified: "Official", Apply_By: day(0) }, // closes today: too late to post
    { ID: "X4", Verified: "Official", Apply_By: day(-1) }, // closed
    { ID: "X5", Verified: "Official", Apply_By: day(3), Posted_On_IG: "Y" }, // already out
    { ID: "X6", Verified: "Official", Apply_By: "", Date_Added: "2026-11-01" }, // no date: last
    { ID: "X7", Verified: "Official", Apply_By: day(4) }, // taken by another post
    { ID: "X8", Verified: "Official", Apply_By: "", Date_Added: "2026-11-09" },
    { ID: "X0", Verified: "Official", Apply_By: day(2), IG_Rejected: "Y" }, // rejected in the admin
  ];
  assert.deepStrictEqual(pickOpenings(tab, "Apply_By", new Set(["X7"])).map((r) => r.ID), ["X3", "X1", "X8", "X6"]);
  assert.deepStrictEqual(pickOpenings(tab, "Apply_By", new Set(), 2).map((r) => r.ID), ["X3", "X7"]);
  console.log("queue.js ok");
}
