// Google Sheet → MongoDB sync.
//   node sync.js                  write changes
//   node sync.js --dry-run        print what would change
//   node sync.js --include-single also sync Single-source rows
//
// Never deletes anything: expired rows and passed deadlines set isActive=false.
// Documents an admin has edited (adminEdited=true) are left untouched.

import { TABS, hasFlag, isDryRun } from "./lib/config.js";
import { readTab, logRun } from "./lib/sheets.js";
import {
  TRUSTED,
  techRowToJob,
  govtRowToJob,
  eventRowToQuiz,
  newsRowToNews,
  missingFields,
} from "./lib/mapping.js";

const dryRun = isDryRun();
const allowed = hasFlag("include-single") ? [...TRUSTED, "Single-source"] : TRUSTED;
const now = new Date();

const SOURCES = [
  { tab: TABS.tech, kind: "job", model: "Job", map: techRowToJob, counter: "Tech_Added" },
  { tab: TABS.govt, kind: "job", model: "Job", map: govtRowToJob, counter: "Govt_Added" },
  { tab: TABS.events, kind: "quiz", model: "Quiz", map: eventRowToQuiz, counter: "Hackathons_Added" },
  { tab: TABS.news, kind: "news", model: "News", map: newsRowToNews, counter: "News_Added" },
];

const sameValue = (a, b) => {
  if (a instanceof Date || b instanceof Date) {
    return (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
  }
  if (typeof a === "object" || typeof b === "object") return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return (a ?? "") === (b ?? "");
};

// Decide what each sheet row should become, without touching the database.
function planRows(source, rows) {
  const upserts = [];
  const expire = [];
  const skipped = [];

  for (const row of rows) {
    const id = row.ID;
    if (!id) continue;

    if (source.kind === "news") {
      const doc = source.map(row);
      if (missingFields(doc, "news").length) skipped.push(`${id}: missing headline`);
      else upserts.push({ id, doc });
      continue;
    }

    const status = (row.Status || "").toLowerCase();
    if (status === "expired") {
      expire.push(id);
      continue;
    }
    if (status !== "active") {
      skipped.push(`${id}: status "${row.Status || "blank"}"`);
      continue;
    }
    if (!allowed.includes(row.Verified)) {
      skipped.push(`${id}: verified "${row.Verified || "blank"}"`);
      continue;
    }

    const doc = source.map(row);
    const missing = missingFields(doc, source.kind);
    if (missing.length) {
      skipped.push(`${id}: missing ${missing.join(", ")}`);
      continue;
    }
    if (doc.deadline && doc.deadline < now) {
      expire.push(id);
      continue;
    }
    if (!doc.verified || !["Official", "Multi-source", "Single-source"].includes(doc.verified)) delete doc.verified;
    upserts.push({ id, doc });
  }
  return { upserts, expire, skipped };
}

async function main() {
  console.log(`Sheet → MongoDB sync${dryRun ? " (dry run)" : ""}. Allowed sources: ${allowed.join(", ")}\n`);

  const plans = [];
  for (const source of SOURCES) {
    const { rows } = await readTab(source.tab);
    plans.push({ source, ...planRows(source, rows), total: rows.length });
  }

  let db = null;
  if (process.env.MONGO_URI) {
    db = await import("./lib/mongo.js");
    await db.connect();
  } else if (!dryRun) {
    throw new Error("MONGO_URI is not set");
  } else {
    console.log("MONGO_URI not set: showing sheet-side plan only (cannot tell new from existing).\n");
  }

  const ownerId = db && !dryRun ? await db.getAutomationUserId() : null;
  const summary = {};
  const runCounts = { Tech_Added: 0, Govt_Added: 0, Hackathons_Added: 0, News_Added: 0, Marked_Expired: 0 };

  for (const { source, upserts, expire, skipped, total } of plans) {
    const s = { rows: total, created: 0, updated: 0, unchanged: 0, deactivated: 0, adminEdited: 0, skipped: skipped.length };
    summary[source.tab] = s;
    const Model = db?.[source.model];

    for (const { id, doc } of upserts) {
      if (!Model) {
        s.created++;
        continue;
      }
      const existing = await Model.findOne({ externalId: id });
      if (existing?.adminEdited) {
        s.adminEdited++;
        continue;
      }
      if (!existing) {
        s.created++;
        runCounts[source.counter]++;
        if (!dryRun) {
          const owner = source.kind === "job" ? { postedBy: ownerId } : source.kind === "quiz" ? { createdBy: ownerId } : {};
          await Model.create({ ...doc, ...owner, externalId: id, origin: source.kind === "news" ? undefined : "auto", isActive: true });
        }
        continue;
      }
      const changes = Object.fromEntries(Object.entries(doc).filter(([k, v]) => !sameValue(existing[k], v)));
      if (existing.isActive === false) changes.isActive = true;
      if (Object.keys(changes).length === 0) {
        s.unchanged++;
        continue;
      }
      s.updated++;
      if (!dryRun) await Model.updateOne({ _id: existing._id }, { $set: changes }, { runValidators: true });
    }

    if (Model && source.kind !== "news") {
      // Expired in the sheet, or the deadline passed (also catches rows deleted from the sheet later)
      const filter = {
        origin: "auto",
        isActive: { $ne: false },
        adminEdited: { $ne: true },
        $or: [{ externalId: { $in: expire } }, { deadline: { $lt: now } }],
      };
      s.deactivated = await Model.countDocuments(filter);
      runCounts.Marked_Expired += s.deactivated;
      if (!dryRun && s.deactivated) await Model.updateMany(filter, { $set: { isActive: false } });
    } else if (!Model) {
      s.deactivated = expire.length;
    }

    if (skipped.length && hasFlag("verbose")) skipped.forEach((msg) => console.log(`  skip ${source.tab} ${msg}`));
  }

  console.table(summary);

  if (!dryRun) {
    const created = Object.values(summary).reduce((n, s) => n + s.created, 0);
    const updated = Object.values(summary).reduce((n, s) => n + s.updated, 0);
    await logRun(`sync: ${created} created, ${updated} updated, ${runCounts.Marked_Expired} deactivated`, runCounts);
  }
  if (db) await db.disconnect();
}

main().catch((err) => {
  console.error(`sync failed: ${err.message}`);
  process.exit(1);
});
