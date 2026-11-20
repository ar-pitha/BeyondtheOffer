// Keeps hand-grouped carousels (CQ-…-G1) current: an opening that closed while the carousel was
// waiting is replaced by the next most urgent free opening of the same kind, the carousel's text
// is rewritten and its preview is cleared so instagram-preview.yml builds a new one. The rest of
// the carousel is kept. Then drafts that mix big-name companies with smaller ones are split: each
// big name gets a reel row of its own, the draft keeps the rest as a carousel. Runs after every sync.
//   node refresh.js             write to the sheet
//   node refresh.js --dry-run   only print what would change

import { TABS, isDryRun } from "./lib/config.js";
import { readTab, updateRow, appendRow, ensureColumns, logRun, nowInZone } from "./lib/sheets.js";
import { CATEGORIES, planSwaps, planBrandSplits } from "../frontend/api/_lib/carousel.js";

const dryRun = isDryRun();
const [{ rows: queue }, ...read] = await Promise.all([TABS.queue, ...Object.values(CATEGORIES).map((c) => c.tab)].map((t) => readTab(t)));
const tabRows = Object.fromEntries(Object.values(CATEGORIES).map((c, i) => [c.tab, read[i].rows]));
const swaps = planSwaps(queue, tabRows);
if (!swaps.length) console.log("No waiting carousel has a closed opening.");

const headers = swaps.length && !dryRun ? await ensureColumns(TABS.queue, ["Preview_Link", "Publish_Confirmed"]) : null;
for (const { row, closed, added, fields } of swaps) {
  const note = `${row.ID}: closed ${closed.join(", ")} → ${added.length ? `added ${added.join(", ")}` : "nothing free to add"}`;
  console.log(`${dryRun ? "[dry run] " : ""}${note}`);
  if (dryRun) continue;
  await updateRow(TABS.queue, headers, row._row, { ...fields, Preview_Link: "", Publish_Confirmed: "" }, { raw: true });
  await logRun(`refresh ${note}`).catch(() => {});
}

// Read again: the swaps above may have changed what a draft holds
const fresh = dryRun ? { rows: queue } : await readTab(TABS.queue);
const splits = planBrandSplits(fresh.rows, tabRows, nowInZone().date);
if (!splits.length) console.log("No draft mixes big-name companies with smaller ones.");
const queueHeaders = splits.length && !dryRun ? await ensureColumns(TABS.queue, ["Preview_Link", "Publish_Confirmed"]) : null;
for (const { row, fields, reels } of splits) {
  const note = `${row.ID}: ${reels.map((r) => `${r.Item_IDs} → reel ${r.ID}`).join(", ") || "becomes a reel"}; keeps ${fields.Item_IDs} as a ${fields.Format.toLowerCase()}`;
  console.log(`${dryRun ? "[dry run] " : ""}${note}`);
  if (dryRun) continue;
  for (const reel of reels) await appendRow(TABS.queue, queueHeaders, reel);
  await updateRow(TABS.queue, queueHeaders, row._row, { ...fields, Preview_Link: "", Publish_Confirmed: "" }, { raw: true });
  await logRun(`split ${note}`).catch(() => {});
}
