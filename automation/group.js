// Groups openings into carousels by rule, so the same opening never lands in two posts:
// for tech jobs, govt jobs and hackathons, the 4 trusted openings with the fewest days left that
// are still open, not on Instagram and not in another waiting post become one Draft row in
// Content_Queue. One carousel waits per category; the next is made once it is published or
// rejected (this runs after every sync and every publish).
// Job and hackathon drafts made any other way are marked Rejected. News drafts are left alone.
//   node group.js             write to the sheet
//   node group.js --dry-run   only print what would change

import "./lib/config.js";
import { TABS, isDryRun } from "./lib/config.js";
import { readTab, appendRow, updateRow, nowInZone, logRun } from "./lib/sheets.js";
import { categoryForRow } from "./lib/category.js";
import { planQueue, pickOpenings, parseSheetDate } from "../frontend/api/_lib/queue.js";

const SIZE = 4;
// ponytail: a single opening isn't a carousel; wait for a second one
const MIN = 2;
const GROUPED = /-G\d+$/; // IDs of rows this script made

const name = (v) => String(v || "").replace(/\s*\([^)]*\)/g, "").trim();
const shortDate = (v) => {
  const d = parseSheetDate(v);
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "";
};
const tag = (v) => `#${name(v).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const tags = (names, rest) => [...names.map(tag).filter((t) => t.length > 2 && t.length <= 20).slice(0, 2), ...rest].join(" ");
const first = (items, column) => shortDate(items.find((i) => parseSheetDate(i[column]))?.[column]);

// Per category: its sheet tab, closing-date column and the words of the draft.
// Slides are built from the sheet rows in Item_IDs; the lines here are what the admin card shows.
const CATEGORIES = {
  tech: {
    tab: TABS.tech,
    date: "Apply_By",
    draft(items) {
      const names = items.map((i) => name(i.Company));
      const more = items.length - 2;
      const who = more > 0 ? `${names[0]}, ${names[1]} and ${more} more` : `${names[0]} and ${names[1]}`;
      const closes = first(items, "Apply_By");
      return {
        title: `${who} hiring freshers`,
        hook: `*${names[0]}*${who.slice(names[0].length)} are hiring freshers | ${items.length} roles open now${closes ? `, first closes ${closes}` : ""}`,
        lines: items.map((i) => [name(i.Company), i.Role, i.Eligibility_Batch, [i.Location, i.Salary_Stipend].filter(Boolean).join(" · "), `Verified: ${i.Verified}`, shortDate(i.Apply_By) ? `Apply by ${i.Apply_By}` : ""]),
        caption: [
          `${items.length} fresher roles open right now${closes ? `, the first closes ${closes}` : ""}`,
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
    tab: TABS.govt,
    date: "Last_Date",
    draft(items) {
      const closes = first(items, "Last_Date");
      const head = `${items.length} govt jobs open now${closes ? `, first closes ${closes}` : ""}`;
      return {
        title: head,
        hook: `*${items.length}* ${head.slice(String(items.length).length + 1)} | Posts, qualification and last dates inside`,
        lines: items.map((i) => [name(i.Organisation), i.Post_Exam, i.Vacancies, i.Qualification, `Verified: ${i.Verified}`, shortDate(i.Last_Date) ? `Last date ${i.Last_Date}` : ""]),
        caption: [
          `${items.length} government jobs are open${closes ? `, and the first closes ${closes}` : ""}`,
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
    tab: TABS.events,
    date: "Register_By",
    draft(items) {
      const closes = first(items, "Register_By");
      const head = `${items.length} hackathons and contests${closes ? `, first closes ${closes}` : " open now"}`;
      return {
        title: head,
        hook: `*${items.length}* ${head.slice(String(items.length).length + 1)} | Prizes, eligibility and deadlines inside`,
        lines: items.map((i) => [name(i.Name), i.Organiser, i.Eligibility, i.Prizes_Perks, `Verified: ${i.Verified}`, shortDate(i.Register_By) ? `Register by ${i.Register_By}` : ""]),
        caption: [
          `${items.length} hackathons and contests to register for${closes ? `, the first closes ${closes}` : ""}`,
          "",
          ...items.map((i) => [name(i.Name), shortDate(i.Register_By) && `register by ${shortDate(i.Register_By)}`].filter(Boolean).join(" · ")),
          "",
          "Comment LINK and we'll DM you every registration link.",
        ],
        hashtags: tags(items.map((i) => i.Name), ["#hackathon", "#codingcontest"]),
      };
    },
  },
};

async function main() {
  const dryRun = isDryRun();
  const [queue, news, ...tabs] = await Promise.all([TABS.queue, TABS.news, ...Object.values(CATEGORIES).map((c) => c.tab)].map((t) => readTab(t)));
  const items = new Map([news, ...tabs].flatMap((t) => t.rows).filter((r) => r.ID).map((r) => [r.ID, r]));
  const waiting = (r) => !["Published", "Rejected"].includes(r.Status);
  const reject = async (row, why) => {
    console.log(`${dryRun ? "[dry run] would reject" : "Rejected"} ${row.ID}: ${why}`);
    if (!dryRun) await updateRow(TABS.queue, queue.headers, row._row, { Status: "Rejected" });
    row.Status = "Rejected";
  };

  // Hand-made drafts for these categories would share openings with the groups
  for (const row of queue.rows) {
    if (waiting(row) && row.Status !== "Approved" && !GROUPED.test(row.ID) && CATEGORIES[categoryForRow(row)]) await reject(row, "not grouped by rule");
  }
  // A group whose openings have all closed or gone out makes room for the next one
  let plan = planQueue(queue.rows, items);
  for (const row of queue.rows) {
    if (waiting(row) && GROUPED.test(row.ID) && plan[row.ID]?.state) await reject(row, plan[row.ID].reason);
  }
  plan = planQueue(queue.rows, items);

  const taken = new Set(queue.rows.filter((r) => r.Status !== "Rejected").flatMap((r) => (r.Status === "Published" ? String(r.Item_IDs || "").split(/[,\s]+/) : plan[r.ID]?.keep || [])));
  const { date } = nowInZone();
  let made = 0;
  for (const [category, cfg] of Object.entries(CATEGORIES)) {
    const current = queue.rows.find((r) => waiting(r) && categoryForRow(r) === category);
    if (current) {
      console.log(`${category}: ${current.ID} is waiting, nothing to group`);
      continue;
    }
    const picked = pickOpenings(tabs[Object.keys(CATEGORIES).indexOf(category)].rows, cfg.date, taken, SIZE);
    if (picked.length < MIN) {
      console.log(`${category}: only ${picked.length} opening(s) qualify, waiting for more`);
      continue;
    }
    const d = cfg.draft(picked);
    const stamp = `CQ-${date.replace(/-/g, "")}-G`;
    const n = 1 + Math.max(0, ...queue.rows.filter((r) => r.ID.startsWith(stamp)).map((r) => Number(r.ID.slice(stamp.length)) || 0));
    const row = {
      ID: `${stamp}${n}`,
      Date: date,
      Format: "Carousel",
      Title: d.title,
      Slides_or_Script: [d.hook, ...d.lines.map((l) => l.filter(Boolean).join(" | ")), "Save this before the deadlines"].join("\n"),
      Caption: d.caption.join("\n"),
      Hashtags: d.hashtags,
      Item_IDs: picked.map((i) => i.ID).join(", "),
      Status: "Draft",
    };
    console.log(`${dryRun ? "[dry run] would add" : "Added"} ${row.ID} (${category}): ${row.Title}\n  ${row.Item_IDs}\n  closes: ${picked.map((i) => i[cfg.date] || "no date").join(" | ")}`);
    if (!dryRun) await appendRow(TABS.queue, queue.headers, row);
    queue.rows.push({ ...row, _row: Infinity });
    picked.forEach((i) => taken.add(i.ID));
    made += 1;
  }
  if (!dryRun && made) await logRun(`group OK: ${made} carousel(s) drafted`).catch(() => {});
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
