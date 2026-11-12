// Keeps hand-grouped carousels (CQ-…-G1) current: an opening that closed while the carousel was
// waiting is replaced by the next most urgent free opening of the same kind, the carousel's text
// is rewritten and its preview is cleared so instagram-preview.yml builds a new one. The rest of
// the carousel is kept. Runs after every sync.
//   node refresh.js             write to the sheet
//   node refresh.js --dry-run   only print what would change

import { TABS, isDryRun } from "./lib/config.js";
import { readTab, updateRow, ensureColumns, logRun } from "./lib/sheets.js";
import { CATEGORIES, planSwaps } from "../frontend/api/_lib/carousel.js";

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
