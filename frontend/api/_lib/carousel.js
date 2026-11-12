// Carousels the admin groups by hand from /admin/feed → Openings, and the swap that keeps them
// current. Used by admin-sheet.js (list, create) and automation/refresh.js (swap closed openings).

import { TRUSTED, isOpen, alreadyPosted, parseSheetDate, planQueue, pickOpenings } from "./queue.js";

export const MAX_OPENINGS = 4;
// IDs of carousels grouped this way (CQ-20261112-G1). Only these are rewritten by the swap.
export const GROUPED = /-G\d+$/;

const name = (v) => String(v || "").replace(/\s*\([^)]*\)/g, "").trim();
const shortDate = (v) => {
  const d = parseSheetDate(v);
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "";
};
const tag = (v) => `#${name(v).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const tags = (names, rest) => [...names.map(tag).filter((t) => t.length > 2 && t.length <= 20).slice(0, 2), ...rest].join(" ");
const firstClose = (items, column) => shortDate(items.find((i) => parseSheetDate(i[column]))?.[column]);

// Per category: its sheet tab, item ID prefix, closing-date column, what the picker shows, and
// the words of the draft. Slides come from the sheet rows in Item_IDs; the lines here are what
// the admin card shows.
export const CATEGORIES = {
  tech: {
    label: "Tech jobs",
    tab: "Tech_Jobs",
    prefix: "TJ-",
    date: "Apply_By",
    show: (i) => ({ name: name(i.Company), detail: [i.Role, i.Eligibility_Batch, i.Location].filter(Boolean).join(" · ") }),
    draft(items) {
      const names = items.map((i) => name(i.Company));
      const more = items.length - 2;
      const who = items.length === 1 ? names[0] : more > 0 ? `${names[0]}, ${names[1]} and ${more} more` : `${names[0]} and ${names[1]}`;
      const closes = firstClose(items, "Apply_By");
      return {
        title: `${who} hiring freshers`,
        hook: `*${names[0]}*${who.slice(names[0].length)} ${items.length === 1 ? "is" : "are"} hiring freshers | ${items.length} ${items.length === 1 ? "role" : "roles"} open now${closes ? `, first closes ${closes}` : ""}`,
        lines: items.map((i) => [name(i.Company), i.Role, i.Eligibility_Batch, [i.Location, i.Salary_Stipend].filter(Boolean).join(" · "), `Verified: ${i.Verified}`, shortDate(i.Apply_By) ? `Apply by ${i.Apply_By}` : ""]),
        caption: [
          `${items.length} fresher ${items.length === 1 ? "role" : "roles"} open right now${closes ? `, the first closes ${closes}` : ""}`,
          "",
          ...items.map((i) => [name(i.Company), i.Role, shortDate(i.Apply_By) && `apply by ${shortDate(i.Apply_By)}`].filter(Boolean).join(" · ")),
          "",
          "Comment JOB and we'll DM you every apply link.",
        ],
        hashtags: tags(names, ["#offcampusdrive", "#jobsforfreshers"]),
      };
    },
  },
  govt: {
    label: "Govt jobs",
    tab: "Govt_Jobs",
    prefix: "GJ-",
    date: "Last_Date",
    show: (i) => ({ name: name(i.Organisation), detail: [i.Post_Exam, i.Vacancies && `${i.Vacancies} posts`, i.Qualification].filter(Boolean).join(" · ") }),
    draft(items) {
      const closes = firstClose(items, "Last_Date");
      const n = items.length;
      return {
        title: `${n} govt ${n === 1 ? "job" : "jobs"} open now${closes ? `, first closes ${closes}` : ""}`,
        hook: `*${n}* govt ${n === 1 ? "job" : "jobs"} open now${closes ? `, first closes ${closes}` : ""} | Posts, qualification and last dates inside`,
        lines: items.map((i) => [name(i.Organisation), i.Post_Exam, i.Vacancies, i.Qualification, `Verified: ${i.Verified}`, shortDate(i.Last_Date) ? `Last date ${i.Last_Date}` : ""]),
        caption: [
          `${n} government ${n === 1 ? "job is" : "jobs are"} open${closes ? `, and the first closes ${closes}` : ""}`,
          "",
          ...items.map((i) => [name(i.Organisation), i.Post_Exam, shortDate(i.Last_Date) && `last date ${shortDate(i.Last_Date)}`].filter(Boolean).join(" · ")),
          "",
          "Comment JOB and we'll DM you every apply link.",
        ],
        hashtags: tags(items.map((i) => i.Organisation), ["#governmentjobs", "#sarkarinaukri"]),
      };
    },
  },
  events: {
    label: "Hackathons",
    tab: "Hackathons_Quizzes",
    prefix: "HQ-",
    date: "Register_By",
    show: (i) => ({ name: name(i.Name), detail: [i.Organiser, i.Type, i.Prizes_Perks].filter(Boolean).join(" · ") }),
    draft(items) {
      const closes = firstClose(items, "Register_By");
      const n = items.length;
      const what = n === 1 ? "hackathon to register for" : "hackathons and contests";
      return {
        title: `${n} ${what}${closes ? `, first closes ${closes}` : ""}`,
        hook: `*${n}* ${what}${closes ? `, first closes ${closes}` : ""} | Prizes, eligibility and deadlines inside`,
        lines: items.map((i) => [name(i.Name), i.Organiser, i.Eligibility, i.Prizes_Perks, `Verified: ${i.Verified}`, shortDate(i.Register_By) ? `Register by ${i.Register_By}` : ""]),
        caption: [
          `${n} ${what}${closes ? `, the first closes ${closes}` : ""}`,
          "",
          ...items.map((i) => [name(i.Name), shortDate(i.Register_By) && `register by ${shortDate(i.Register_By)}`].filter(Boolean).join(" · ")),
          "",
          "Comment LINK and we'll DM you every registration link.",
        ],
        hashtags: tags(items.map((i) => i.Name), ["#hackathon", "#codingcontest"]),
      };
    },
  },
  // News has no closing date and no Verified column: newest first, and every story qualifies
  // until it has been used in a post. The slides get the "Did you know?" look automatically.
  news: {
    label: "Tech news",
    tab: "Tech_News",
    prefix: "TN-",
    news: true,
    show: (i) => ({ name: i.Headline, detail: [i.Topic, i.Source].filter(Boolean).join(" · ") }),
    draft(items) {
      const n = items.length;
      const more = n - 1;
      return {
        title: items[0].Headline,
        hook: `${items[0].Headline} | ${more ? `${more} more ${more === 1 ? "story" : "stories"} students should know` : "What it means for students"}`,
        lines: items.map((i) => [i.Headline, i.Why_It_Matters_For_Students || i.Summary]),
        caption: [
          items[0].Headline,
          "",
          ...items.map((i) => i.Headline),
          "",
          "Comment LINK for the sources.",
        ],
        hashtags: "#technews #ai #techupdates #students",
      };
    },
  },
};

export const categoryOfId = (id) => Object.keys(CATEGORIES).find((c) => String(id).startsWith(CATEGORIES[c].prefix));

const closesAt = (item, cfg) => (cfg.news ? Infinity : parseSheetDate(item[cfg.date])?.getTime() ?? Infinity);
// Openings: fewest days left first. News: newest first.
const byUrgency = (cfg) => (a, b) =>
  cfg.news
    ? String(b.Date || "").localeCompare(String(a.Date || ""))
    : closesAt(a, cfg) - closesAt(b, cfg) || String(b.Date_Added || "").localeCompare(String(a.Date_Added || ""));
const trusted = (r, cfg) => cfg.news || TRUSTED.includes(r.Verified);

// The fields of a Content_Queue row for these openings (already sorted)
export function carouselFields(category, items) {
  const d = CATEGORIES[category].draft(items);
  return {
    Title: d.title,
    Slides_or_Script: [d.hook, ...d.lines.map((l) => l.filter(Boolean).join(" | ")), "Save this before the deadlines"].join("\n"),
    Caption: d.caption.join("\n"),
    Hashtags: d.hashtags,
    Item_IDs: items.map((i) => i.ID).join(", "),
  };
}

// Which waiting post (Draft or Approved) keeps each opening, after the per-opening rules
export function takenBy(queue, itemsById) {
  const plan = planQueue(queue, itemsById);
  const owner = new Map();
  for (const row of queue) {
    if (["Draft", "Approved", ""].includes(row.Status || "") && plan[row.ID]) plan[row.ID].keep.forEach((id) => owner.set(id, row.ID));
  }
  return owner;
}

// What the picker lists: per category, trusted openings that are still open and not on
// Instagram, fewest days left first. Closed and posted ones never appear.
export function openingsList(queue, tabRows) {
  const itemsById = new Map(Object.values(tabRows).flat().filter((r) => r.ID).map((r) => [r.ID, r]));
  const owner = takenBy(queue, itemsById);
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(CATEGORIES).map(([category, cfg]) => [
      category,
      (tabRows[cfg.tab] || [])
        .filter((r) => r.ID && trusted(r, cfg) && isOpen(r) && !alreadyPosted(r))
        .sort(byUrgency(cfg))
        .map((r) => {
          const at = closesAt(r, cfg);
          const added = parseSheetDate(r.Date)?.getTime();
          return {
            id: r.ID,
            ...cfg.show(r),
            closes: Number.isFinite(at) ? shortDate(r[cfg.date]) : "",
            daysLeft: Number.isFinite(at) ? Math.max(0, Math.ceil((at - now) / 86_400_000)) : null,
            // News: whole days since the story's date (0 = today)
            ...(cfg.news && { age: added ? Math.max(0, Math.ceil((now - added) / 86_400_000)) : null }),
            verified: r.Verified || (cfg.news ? r.Source || "News" : ""),
            takenBy: owner.get(r.ID) || "",
          };
        }),
    ])
  );
}

// Checks a hand-picked group. Returns { category, items } or throws with the reason.
export function checkGroup(ids, queue, tabRows) {
  const unique = [...new Set((ids || []).map(String))];
  if (!unique.length || unique.length > MAX_OPENINGS) throw new Error(`Pick 1 to ${MAX_OPENINGS} openings.`);
  const category = categoryOfId(unique[0]);
  if (!category || unique.some((id) => categoryOfId(id) !== category)) throw new Error("A carousel holds one kind: tech jobs, govt jobs, hackathons or tech news.");
  const cfg = CATEGORIES[category];
  const rows = tabRows[cfg.tab] || [];
  const itemsById = new Map(Object.values(tabRows).flat().filter((r) => r.ID).map((r) => [r.ID, r]));
  const owner = takenBy(queue, itemsById);
  const items = unique.map((id) => {
    const r = rows.find((x) => x.ID === id);
    if (!r) throw new Error(`${id} isn't in ${cfg.tab}.`);
    if (!trusted(r, cfg)) throw new Error(`${id} is ${r.Verified || "not verified"}; only Official and Multi-source go out.`);
    if (!isOpen(r)) throw new Error(`${id} has closed.`);
    if (alreadyPosted(r)) throw new Error(`${id} is already on Instagram.`);
    if (owner.has(id)) throw new Error(`${id} is already in ${owner.get(id)}.`);
    return r;
  });
  return { category, items: items.sort(byUrgency(cfg)) };
}

export function nextGroupId(queue, date) {
  const stamp = `CQ-${date.replace(/-/g, "")}-G`;
  return `${stamp}${1 + Math.max(0, ...queue.filter((r) => String(r.ID).startsWith(stamp)).map((r) => Number(r.ID.slice(stamp.length)) || 0))}`;
}

// For each waiting grouped carousel with closed openings: the same carousel with each closed
// opening replaced by the next most urgent free one of its kind (fewer if none are left).
// Returns [{ row, category, closed: [ids], added: [ids], fields }].
export function planSwaps(queue, tabRows) {
  const itemsById = new Map(Object.values(tabRows).flat().filter((r) => r.ID).map((r) => [r.ID, r]));
  const taken = new Set(takenBy(queue, itemsById).keys());
  queue.filter((r) => r.Status === "Published").forEach((r) => String(r.Item_IDs || "").split(/[,\s]+/).forEach((id) => id && taken.add(id)));
  const swaps = [];
  for (const row of queue) {
    if (!["Draft", "Approved"].includes(row.Status) || !GROUPED.test(row.ID)) continue;
    const ids = String(row.Item_IDs || "").split(/[,\s]+/).filter(Boolean);
    const category = categoryOfId(ids[0]);
    if (!category) continue;
    const cfg = CATEGORIES[category];
    const current = ids.map((id) => itemsById.get(id)).filter(Boolean);
    const closed = current.filter((i) => !isOpen(i));
    if (!closed.length) continue;
    ids.forEach((id) => taken.add(id));
    const added = pickOpenings(tabRows[cfg.tab] || [], cfg.date, taken, closed.length);
    added.forEach((i) => taken.add(i.ID));
    const items = [...current.filter((i) => isOpen(i)), ...added].sort(byUrgency(cfg));
    if (!items.length) continue; // nothing left to swap in: it shows as expired in /admin/feed
    swaps.push({ row, category, closed: closed.map((i) => i.ID), added: added.map((i) => i.ID), fields: carouselFields(category, items) });
  }
  return swaps;
}

// Self-check: node frontend/api/_lib/carousel.js
if (process.argv[1]?.replace(/\\/g, "/").endsWith("_lib/carousel.js")) {
  const { default: assert } = await import("node:assert");
  const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const tech = [
    { ID: "TJ-1", Company: "Acme", Role: "SDE", Verified: "Official", Apply_By: day(-1) }, // closed
    { ID: "TJ-2", Company: "Bolt", Role: "Analyst", Verified: "Official", Apply_By: day(9) },
    { ID: "TJ-3", Company: "Core", Role: "Intern", Verified: "Multi-source", Apply_By: day(3) },
    { ID: "TJ-4", Company: "Dune", Role: "QA", Verified: "Single-source", Apply_By: day(2) }, // not trusted
    { ID: "TJ-5", Company: "Echo", Role: "SRE", Verified: "Official", Apply_By: day(5), Posted_On_IG: "Y" }, // out
    { ID: "TJ-6", Company: "Flux", Role: "Dev", Verified: "Official", Apply_By: day(6) },
  ];
  const news = [
    { ID: "TN-1", Headline: "Old story", Date: day(-30) },
    { ID: "TN-2", Headline: "New story", Date: day(-1), Why_It_Matters_For_Students: "Jobs" },
    { ID: "TN-3", Headline: "Used story", Date: day(0), Used_In_Post: "Y" },
  ];
  const tabRows = { Tech_Jobs: tech, Govt_Jobs: [{ ID: "GJ-1", Organisation: "SSC", Verified: "Official", Last_Date: day(4) }], Hackathons_Quizzes: [], Tech_News: news };
  const queue = [{ ID: "CQ-1-G1", _row: 2, Status: "Draft", Item_IDs: "TJ-1, TJ-2" }];

  const list = openingsList(queue, tabRows);
  assert.deepStrictEqual(list.tech.map((o) => `${o.id}:${o.takenBy}`), ["TJ-3:", "TJ-6:", "TJ-2:CQ-1-G1"]);
  assert.throws(() => checkGroup(["TJ-2"], queue, tabRows), /already in CQ-1-G1/);
  assert.throws(() => checkGroup(["TJ-1"], queue, tabRows), /closed/);
  assert.throws(() => checkGroup(["TJ-4"], queue, tabRows), /Single-source/);
  assert.throws(() => checkGroup(["TJ-3", "GJ-1"], queue, tabRows), /one kind/);
  assert.throws(() => checkGroup(["TJ-2", "TJ-3", "TJ-6", "TJ-1", "TJ-5"], queue, tabRows), /1 to 4/);
  const g = checkGroup(["TJ-6", "TJ-3"], queue, tabRows);
  assert.deepStrictEqual(g.items.map((i) => i.ID), ["TJ-3", "TJ-6"]);
  assert.match(carouselFields(g.category, g.items).Title, /Core and Flux/);
  // News: newest first, never expires, used stories are gone, no Verified needed
  assert.deepStrictEqual(list.news.map((o) => o.id), ["TN-2", "TN-1"]);
  assert.strictEqual(list.news[0].age, 1);
  const n = checkGroup(["TN-1", "TN-2"], queue, tabRows);
  assert.deepStrictEqual(n.items.map((i) => i.ID), ["TN-2", "TN-1"]);
  assert.match(carouselFields("news", n.items).Slides_or_Script, /^New story \| 1 more story/);
  assert.throws(() => checkGroup(["TN-3"], queue, tabRows), /already on Instagram/);
  assert.strictEqual(nextGroupId([...queue, { ID: "CQ-20261112-G2" }], "2026-11-12"), "CQ-20261112-G3");

  // TJ-1 closed: swapped for the most urgent free one (TJ-3), TJ-2 stays
  const [s] = planSwaps(queue, tabRows);
  assert.deepStrictEqual([s.closed, s.added, s.fields.Item_IDs], [["TJ-1"], ["TJ-3"], "TJ-3, TJ-2"]);
  console.log("carousel.js ok");
}
