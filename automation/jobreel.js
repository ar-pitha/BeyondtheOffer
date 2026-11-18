// Local preview of the faceless job reel (lib/brollReel.js). Only renders; never uploads or posts.
//   node jobreel.js --sample             fixture CQ-SAMPLE-1, no sheet needed
//   node jobreel.js --id CQ-20261117-01  a real Content_Queue row (reads the sheet, writes nothing)
//   --variant 2                          different shots and music for the same post
// Output: automation/renders/reel-preview/<ID>/reel.mp4 and cover.jpg

import fs from "node:fs";
import path from "node:path";
import { ROOT, TABS } from "./lib/config.js";
import { closeBrowser } from "./lib/render.js";
import { categoryForRow } from "./lib/category.js";
import { buildJobReel, REEL_CATEGORIES } from "./lib/brollReel.js";

const argv = process.argv.slice(2);
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);

async function loadRow() {
  if (argv.includes("--sample")) {
    const rows = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures", "content-queue.sample.json"), "utf8"));
    return { row: rows.find((r) => r.ID === (arg("--id") || "CQ-SAMPLE-1")), items: [] };
  }
  const id = arg("--id");
  if (!id) throw new Error("Usage: node jobreel.js --sample | --id <Content_Queue ID> [--variant N]");
  const { readTab } = await import("./lib/sheets.js");
  const { rows } = await readTab(TABS.queue);
  return { row: rows.find((r) => r.ID === id), items: undefined };
}

try {
  const { row, items } = await loadRow();
  if (!row) throw new Error("Content_Queue row not found");
  const category = categoryForRow(row);
  if (!REEL_CATEGORIES.includes(category)) console.warn(`${row.ID} is a ${category} post; those go out as carousels. Rendering a reel anyway.`);
  const started = Date.now();
  const outDir = path.join(ROOT, "renders", "reel-preview", row.ID);
  const reel = await buildJobReel(row, outDir, { category, items, variant: Number(arg("--variant") || 0) });
  console.log(`Reel ready: ${reel.file}`);
  console.log(`  ${reel.seconds.toFixed(1)}s, ${reel.scenes.length} scenes, music: ${reel.track}, built in ${Math.round((Date.now() - started) / 1000)}s`);
  reel.clips.forEach((c, i) => console.log(`  scene ${i + 1}: ${reel.scenes[i].items.map((x) => x.text || x.company || x.chips?.join(" ")).filter(Boolean).join(" / ")}  ← ${c.about} (mixkit ${c.id})`));
} catch (err) {
  console.error(`job reel failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser();
}
