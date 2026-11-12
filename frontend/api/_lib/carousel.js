// The Instagram board in /admin/feed: openings to pick from, the posts grouped from them, and
// the swap that keeps a waiting post current. Used by admin-sheet.js (board, create, reject) and
// automation/refresh.js (swap closed openings).

import { TRUSTED, GROUPED, isOpen, alreadyPosted, igRejected, parseSheetDate, planQueue, pickOpenings } from "./queue.js";

export { GROUPED };
export const MAX_OPENINGS = 4;
// News cards are short, so a news post can carry more stories
export const MAX_STORIES = 6;
export const maxFor = (category) => (category === "news" ? MAX_STORIES : MAX_OPENINGS);
// The Expired list only goes back this far
const EXPIRED_DAYS = 30;

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
    show: (i) => ({ name: name(i.Company), detail: [name(i.Role), name(i.Location), i.Eligibility_Batch].filter(Boolean).join(" · ") }),
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
    show: (i) => ({ name: name(i.Organisation), detail: [name(i.Post_Exam), i.Vacancies && `${i.Vacancies} posts`, i.Qualification].filter(Boolean).join(" · ") }),
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
      const hook = newsHook(items);
      return {
        title: hook.replace(/\*/g, ""),
        hook,
        lines: items.map((i) => [i.Headline, i.Why_It_Matters_For_Students || i.Summary]),
        caption: [
          hook.replace(/\*/g, ""),
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

const DAY = 86_400_000;
const itemsMap = (tabRows) => new Map(Object.values(tabRows).flat().filter((r) => r.ID).map((r) => [r.ID, r]));
const idsIn = (row) => String(row.Item_IDs || "").split(/[,\s]+/).filter(Boolean);
const isWaitingPost = (r) => GROUPED.test(r.ID) && ["Draft", "Approved"].includes(r.Status || "Draft");

// Which waiting post keeps each opening, after the per-opening rules
export function takenBy(queue, itemsById) {
  const plan = planQueue(queue, itemsById);
  const owner = new Map();
  for (const row of queue) if (row.Status !== "Published" && plan[row.ID]) plan[row.ID].keep.forEach((id) => owner.set(id, row.ID));
  return owner;
}

// One opening as the board shows it
function describe(r, category, cfg, now) {
  const at = closesAt(r, cfg);
  const dated = parseSheetDate(r.Date)?.getTime();
  return {
    id: r.ID,
    category,
    ...cfg.show(r),
    closes: Number.isFinite(at) ? shortDate(r[cfg.date]) : "",
    // Whole days after today: an opening closing tonight (end of day IST) is 0, "Closes today"
    daysLeft: Number.isFinite(at) ? Math.max(0, Math.floor((at - now) / DAY)) : null,
    // News: whole days since the story's date (0 = today)
    ...(cfg.news && { age: dated ? Math.max(0, Math.ceil((now - dated) / DAY)) : null }),
    verified: r.Verified || (cfg.news ? r.Source || "News" : ""),
    closed: !isOpen(r),
    // When it reached the sheet, for newest/oldest sorting (news: the story's date)
    addedAt: parseSheetDate(r.Date_Added || r.Date)?.getTime() || 0,
  };
}

const POST_FIELDS = ["ID", "Date", "Title", "Caption", "Hashtags", "Item_IDs", "Status", "Preview_Link", "IG_Post_Link", "Design_Link"];
const postFields = (row) => Object.fromEntries(POST_FIELDS.map((k) => [k, row[k] || ""]));
const kindOf = (row) => categoryOfId(idsIn(row)[0]) || null;

// Everything the board shows, in one read:
// - openings: trusted, open, not on Instagram, not rejected and not in a waiting post. Jobs and
//   hackathons fewest days left first; news newest first.
// - posts: carousels grouped in the admin that aren't out yet, with their openings.
// - published; rejected (openings); expired (openings that closed in the last 30 days).
export function buildBoard(queue, tabRows) {
  const itemsById = itemsMap(tabRows);
  const owner = takenBy(queue, itemsById);
  const now = Date.now();
  const board = { openings: [], inPosts: 0, rejected: [], expired: [] };
  for (const [category, cfg] of Object.entries(CATEGORIES)) {
    const rows = (tabRows[cfg.tab] || []).filter((r) => r.ID && trusted(r, cfg) && !alreadyPosted(r)).sort(byUrgency(cfg));
    for (const r of rows) {
      const o = describe(r, category, cfg, now);
      if (igRejected(r)) board.rejected.push(o);
      else if (o.closed) {
        const at = closesAt(r, cfg);
        if (!Number.isFinite(at) || now - at < EXPIRED_DAYS * DAY) board.expired.push({ ...o, closedAt: Number.isFinite(at) ? at : 0 });
      } else if (owner.has(r.ID)) board.inPosts += 1;
      else board.openings.push(o);
    }
  }
  board.expired.sort((x, y) => y.closedAt - x.closedAt);
  board.posts = queue
    .filter(isWaitingPost)
    .reverse()
    .map((row) => ({
      ...postFields(row),
      category: kindOf(row),
      items: idsIn(row).map((id) => {
        const r = itemsById.get(id);
        const c = categoryOfId(id);
        return r && c ? describe(r, c, CATEGORIES[c], now) : { id, name: id, detail: "", closed: true };
      }),
    }));
  board.published = queue.filter((r) => r.Status === "Published").reverse().map((row) => ({ ...postFields(row), category: kindOf(row) }));
  board.categories = Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, c.label]));
  return board;
}

// Checks a hand-picked group. Returns { category, items } or throws with the reason.
export function checkGroup(ids, queue, tabRows) {
  const unique = [...new Set((ids || []).map(String))];
  const category = categoryOfId(unique[0]);
  if (!category || unique.some((id) => categoryOfId(id) !== category)) throw new Error("A carousel holds one kind: tech jobs, govt jobs, hackathons or tech news.");
  const cfg = CATEGORIES[category];
  const max = maxFor(category);
  if (unique.length > max) throw new Error(`Pick 1 to ${max} ${cfg.news ? "stories" : "openings"}.`);
  const rows = tabRows[cfg.tab] || [];
  const owner = takenBy(queue, itemsMap(tabRows));
  const items = unique.map((id) => {
    const r = rows.find((x) => x.ID === id);
    if (!r) throw new Error(`${id} isn't in ${cfg.tab}.`);
    if (!trusted(r, cfg)) throw new Error(`${id} is ${r.Verified || "not verified"}; only Official and Multi-source go out.`);
    if (!isOpen(r)) throw new Error(`${id} has closed.`);
    if (alreadyPosted(r)) throw new Error(`${id} is already on Instagram.`);
    if (igRejected(r)) throw new Error(`${id} was rejected. Restore it first.`);
    if (owner.has(id)) throw new Error(`${id} is already in ${owner.get(id)}.`);
    return r;
  });
  return { category, items: items.sort(byUrgency(cfg)) };
}

export function nextGroupId(queue, date) {
  const stamp = `CQ-${date.replace(/-/g, "")}-G`;
  return `${stamp}${1 + Math.max(0, ...queue.filter((r) => String(r.ID).startsWith(stamp)).map((r) => Number(r.ID.slice(stamp.length)) || 0))}`;
}

// ---- tech news groups itself: every free story lands in a waiting post, no schedule ----

const MIN_STORIES = 3;
const FILL_TO = 4; // a theme with fewer stories is topped up with the newest others

// The sheet's Topic is free text ("Security", "Cybersecurity"); similar ones share a theme
const THEMES = [
  ["Security", /secur|cyber|privacy|hack|breach|malware/i],
  ["AI", /\bai\b|model|machine learning|llm|robot|agent/i],
  ["Developer tools", /develop|dev ?tools|programming|open source|software|coding/i],
  ["Cloud and hardware", /cloud|hardware|chip|semiconductor|space|quantum/i],
  ["Jobs and industry", /job|industry|career|education|hiring|layoff|big tech|startup/i],
  ["Policy", /policy|regulat|law|govern|web/i],
];
// The cover of a news post: what the whole post is about, not its first story.
// "*4* tech stories you should know today", or the theme when every story shares one.
export function newsHook(items) {
  const themes = [...new Set(items.map(themeOf))];
  const theme = themes.length === 1 && themes[0] !== "Other" ? themes[0].replace(/^(?!AI)\w/,(c) => c.toLowerCase()) : "tech";
  return `*${items.length}* ${theme} ${items.length === 1 ? "story" : "stories"} you should know today`;
}

export const themeOf = (story) => (THEMES.find(([, re]) => re.test(story.Topic || "")) || ["Other"])[0];
const storyTime = (s) => parseSheetDate(s.Date)?.getTime() || 0;

// One post's stories: the theme with the most stories, newest first, up to 6; topped up with
// the newest others when the theme has fewer than 4. Null when under 3. Stories of any age
// count: every free story ends up in a post.
export function pickStories(stories) {
  const fresh = [...stories].sort((a, b) => storyTime(b) - storyTime(a));
  if (fresh.length < MIN_STORIES) return null;
  const counts = new Map();
  for (const s of fresh) counts.set(themeOf(s), (counts.get(themeOf(s)) || 0) + 1);
  // Most stories wins; on a tie, the theme with the newest story (fresh is newest first)
  const theme = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a))[0];
  const picked = fresh.filter((s) => themeOf(s) === theme).slice(0, MAX_STORIES);
  for (const s of fresh) if (picked.length < FILL_TO && !picked.includes(s)) picked.push(s);
  return { theme, stories: picked.sort((a, b) => storyTime(b) - storyTime(a)) };
}

// Every free news story (not posted, rejected or in a waiting post) grouped into new post rows.
// Under 3 stories left over: they wait for more. Pure; the caller appends the rows.
export function newsPosts(queue, tabRows, date) {
  const owner = takenBy(queue, itemsMap(tabRows));
  let free = (tabRows[CATEGORIES.news.tab] || []).filter((s) => s.ID && s.Headline && !alreadyPosted(s) && !igRejected(s) && !owner.has(s.ID));
  const rows = [];
  for (let pick; (pick = pickStories(free)); ) {
    const ID = nextGroupId([...queue, ...rows], date);
    rows.push({ ID, Date: date, Format: "Carousel", Status: "Draft", ...carouselFields("news", pick.stories), _theme: pick.theme });
    free = free.filter((s) => !pick.stories.includes(s));
  }
  return rows;
}

// For each waiting grouped carousel with closed openings: the same carousel with each closed
// opening replaced by the next most urgent free one of its kind (fewer if none are left).
// Returns [{ row, category, closed: [ids], added: [ids], fields }].
export function planSwaps(queue, tabRows) {
  const itemsById = itemsMap(tabRows);
  const taken = new Set(takenBy(queue, itemsById).keys());
  queue.filter((r) => r.Status === "Published").forEach((r) => idsIn(r).forEach((id) => taken.add(id)));
  const swaps = [];
  for (const row of queue) {
    if (!isWaitingPost(row)) continue;
    const ids = idsIn(row);
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
  tech.push({ ID: "TJ-7", Company: "Gale", Verified: "Official", Apply_By: day(4), IG_Rejected: "Y" });
  tech.push({ ID: "TJ-8", Company: "Halo", Verified: "Official", Apply_By: day(-60) }); // closed long ago
  const queue = [
    { ID: "CQ-0", _row: 1, Status: "Published", Item_IDs: "TJ-5" },
    { ID: "CQ-1-G1", _row: 2, Status: "Draft", Item_IDs: "TJ-1, TJ-2" },
    { ID: "CQ-OLD", _row: 3, Status: "Draft", Item_IDs: "TJ-6" }, // daily-task draft: holds nothing
  ];

  const board = buildBoard(queue, tabRows);
  assert.deepStrictEqual(board.openings.filter((o) => o.category === "tech").map((o) => o.id), ["TJ-3", "TJ-6"]);
  assert.strictEqual(board.inPosts, 1);
  assert.deepStrictEqual(board.rejected.map((o) => o.id), ["TJ-7"]);
  assert.deepStrictEqual(board.expired.map((o) => o.id), ["TJ-1"]);
  assert.deepStrictEqual(
    board.posts.map((p) => [p.ID, p.category, p.items.map((i) => `${i.id}${i.closed ? "(closed)" : ""}`).join(" ")]),
    [["CQ-1-G1", "tech", "TJ-1(closed) TJ-2"]]
  );
  assert.deepStrictEqual(board.published.map((p) => p.ID), ["CQ-0"]);
  assert.throws(() => checkGroup(["TJ-7"], queue, tabRows), /rejected/);
  const list = { news: board.openings.filter((o) => o.category === "news") };
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
  assert.match(carouselFields("news", n.items).Slides_or_Script, /^\*2\* tech stories you should know today\nNew story/);
  assert.throws(() => checkGroup(["TN-3"], queue, tabRows), /already on Instagram/);
  assert.strictEqual(nextGroupId([...queue, { ID: "CQ-20261112-G2" }], "2026-11-12"), "CQ-20261112-G3");

  // TJ-1 closed: swapped for the most urgent free one (TJ-3), TJ-2 stays
  const [s] = planSwaps(queue, tabRows);
  assert.deepStrictEqual([s.closed, s.added, s.fields.Item_IDs], [["TJ-1"], ["TJ-3"], "TJ-3, TJ-2"]);
  // News: the biggest theme first (tie: the one with the newest story), topped up to 4; too few wait
  const ago = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
  const st = (id, topic, d) => ({ ID: id, Topic: topic, Date: ago(d), Headline: id });
  const stories = [st("A", "Cybersecurity", 0), st("B", "Security", 1), st("C", "AI models", 0), st("D", "Open models", 1), st("E", "AI research", 2), st("F", "Cybersecurity", 10), st("G", "Developer tools", 0)];
  const p = pickStories(stories);
  assert.strictEqual(p.theme, "Security"); // 3 security (F is old but counts) tie 3 AI; A is newest
  assert.deepStrictEqual(p.stories.map((x) => x.ID).sort(), ["A", "B", "C", "F"]);
  assert.strictEqual(pickStories(stories.slice(5)), null);
  assert.strictEqual(themeOf({ Topic: "Cloud / Hardware" }), "Cloud and hardware");
  assert.strictEqual(newsHook(stories.slice(2, 5)), "*3* AI stories you should know today");
  assert.strictEqual(newsHook(stories.slice(0, 3)), "*3* tech stories you should know today");
  // Every free story is grouped, several posts at once; one already in a post is left alone
  const pile = Array.from({ length: 9 }, (_, i) => ({ ...st(`TN-${i}`, "Security", 0), Summary: "x" }));
  const made = newsPosts([{ ID: "CQ-20261112-G1", Status: "Draft", Item_IDs: "TN-8" }], { Tech_News: pile }, "2026-11-12");
  assert.deepStrictEqual(made.map((r) => r.ID), ["CQ-20261112-G2"]); // 8 free: 6, then 2 wait
  assert.strictEqual(made[0].Item_IDs.split(", ").length, MAX_STORIES);
  assert.strictEqual(newsPosts([], { Tech_News: [...pile, ...pile.map((s) => ({ ...s, ID: s.ID + "b" }))] }, "2026-11-12").length, 3);
  console.log("carousel.js ok");
}
