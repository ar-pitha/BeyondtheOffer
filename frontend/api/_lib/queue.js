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

const idsOf = (row) => String(row.Item_IDs || "").split(/[,\s]+/).filter(Boolean);
const labelOf = (i) => String(i.Company || i.Organisation || i.Name || i.Headline || i.ID).replace(/\s*\([^)]*\)/g, "").trim();

// Plans every post that isn't out yet, one opening at a time:
//   { [post ID]: { keep: [item IDs], dropped: [{ id, label, why }], state?, reason? } }
// An opening is left off its carousel when it has closed, is already on Instagram, or another
// post that isn't out yet keeps it (approved posts first, then the newest draft). The rest of
// the carousel stays. state is set only when nothing is left to post: "expired" when every
// opening has closed, otherwise "duplicate". Tech news has no closing date and never expires.
export function planQueue(queue, itemsById) {
  const rank = { Published: 0, Approved: 1 };
  const order = queue
    .filter((r) => r.Status !== "Rejected")
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
    { ID: "B", _row: 3, Status: "Draft", Item_IDs: "TJ-1, TJ-2, TJ-5" }, // keeps TJ-5 only
    { ID: "C", _row: 4, Status: "Draft", Item_IDs: "TJ-2" }, // closed
    { ID: "D", _row: 5, Status: "Draft", Item_IDs: "TJ-1 TJ-3" }, // newer than B: keeps TJ-1
    { ID: "E", _row: 6, Status: "Approved", Item_IDs: "TJ-4" },
    { ID: "F", _row: 7, Status: "Draft", Item_IDs: "TJ-4, TJ-3" }, // TJ-4 is approved in E, TJ-3 is out
    { ID: "G", _row: 8, Status: "Draft", Item_IDs: "TN-1" }, // news never expires
    { ID: "H", _row: 9, Status: "Rejected", Item_IDs: "TJ-1" },
    { ID: "I", _row: 10, Status: "Draft", Item_IDs: "" },
  ];
  const p = planQueue(queue, items);
  assert.deepStrictEqual(Object.fromEntries(Object.entries(p).filter(([, v]) => v.state).map(([k, v]) => [k, v.state])), { C: "expired", F: "duplicate" });
  assert.deepStrictEqual(p.B.keep, ["TJ-5"]);
  assert.deepStrictEqual(p.B.dropped.map((d) => `${d.label}: ${d.why}`), ["Acme: in D", "Bolt: closed"]);
  assert.deepStrictEqual(p.D.keep, ["TJ-1"]);
  assert.deepStrictEqual(p.G.keep, ["TN-1"]);
  assert.ok(!p.H && !p.A);
  console.log("queue.js ok");
}
