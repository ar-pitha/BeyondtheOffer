import path from "node:path";
import { ROOT } from "./lib/config.js";
import { readTab, updateRow, ensureColumns } from "./lib/sheets.js";
import { closeBrowser } from "./lib/render.js";
import { renderPost } from "./lib/post.js";
import { categoryForRow } from "./lib/category.js";
import { uploadSlides, hasCloudinary } from "./lib/cloudinary.js";

if (!hasCloudinary()) throw new Error("Cloudinary is required for admin previews");

const argv = process.argv.slice(2);
const requestedId = argv.includes("--id") ? argv[argv.indexOf("--id") + 1] : null;
const all = argv.includes("--all");
if (!requestedId && !all) throw new Error("Usage: node preview.js --id <Content_Queue_ID> or --all");

const { headers, rows } = await readTab("Content_Queue");
const targets = rows.filter((row) =>
  (!requestedId || row.ID === requestedId) &&
  row.Format &&
  row.Slides_or_Script &&
  row.Status !== "Published" &&
  !row.Preview_Link
);
if (requestedId && !targets.length) {
  const row = rows.find((item) => item.ID === requestedId);
  if (!row) throw new Error(`No Content_Queue row with ID ${requestedId}`);
  console.log(`${requestedId} already has a preview or is not eligible.`);
}

for (const row of targets) {
  const outDir = path.join(ROOT, "renders", "preview", row.ID);
  try {
    // Same renderer as publishing: every format becomes white carousel slides
    const images = await renderPost(row, outDir, { category: categoryForRow(row) });
    const previewLinks = await uploadSlides(images, `${row.ID}/preview`);
    const nextHeaders = headers.includes("Preview_Link") ? headers : await ensureColumns("Content_Queue", ["Preview_Link"]);
    await updateRow("Content_Queue", nextHeaders, row._row, { Preview_Link: previewLinks.join("\n") }, { raw: true });
    console.log(`Preview ready for ${row.ID}`);
  } catch (error) {
    console.error(`Preview failed for ${row.ID}: ${error.message}`);
  }
}

await closeBrowser();
