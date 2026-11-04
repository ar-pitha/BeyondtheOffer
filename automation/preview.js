import path from "node:path";
import { ROOT } from "./lib/config.js";
import { readTab, updateRow, ensureColumns } from "./lib/sheets.js";
import { closeBrowser, parseSlides } from "./lib/render.js";
import { buildReel, renderPostSlides, slidesToCards } from "./reels.js";
import { categoryForRow } from "./lib/category.js";
import { uploadSlides, uploadVideo, hasCloudinary } from "./lib/cloudinary.js";

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
    // Same renderers as publishing: reels and stories are voiced videos, carousels themed slides
    let previewLinks;
    const format = String(row.Format).toLowerCase();
    const category = categoryForRow(row);
    if (format === "reel" || format === "story") {
      const cards = format === "story" ? slidesToCards(parseSlides(row.Slides_or_Script), { title: row.Title, category, complete: true }) : undefined;
      // A new variant on every build, so Regenerate gives a differently cut video
      const result = await buildReel(row.Slides_or_Script, outDir, { category, cards, variant: Math.floor(Date.now() / 1000) });
      previewLinks = [await uploadVideo(result.file, { folder: `beyondtheoffer/${row.ID}/preview`, publicId: "reel" })];
    } else {
      const images = await renderPostSlides(parseSlides(row.Slides_or_Script), outDir, { category, script: row.Slides_or_Script });
      previewLinks = await uploadSlides(images, `${row.ID}/preview`);
    }
    const nextHeaders = headers.includes("Preview_Link") ? headers : await ensureColumns("Content_Queue", ["Preview_Link"]);
    await updateRow("Content_Queue", nextHeaders, row._row, { Preview_Link: previewLinks.join("\n") }, { raw: true });
    console.log(`Preview ready for ${row.ID}`);
  } catch (error) {
    console.error(`Preview failed for ${row.ID}: ${error.message}`);
  }
}

await closeBrowser();
