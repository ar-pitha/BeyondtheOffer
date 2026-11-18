import path from "node:path";
import { ROOT } from "./lib/config.js";
import { readTab, updateRow, ensureColumns } from "./lib/sheets.js";
import { closeBrowser } from "./lib/render.js";
import { renderPost } from "./lib/post.js";
import { categoryForRow } from "./lib/category.js";
import { uploadSlides, uploadVideo, hasCloudinary } from "./lib/cloudinary.js";
import { buildJobReel, REEL_CATEGORIES } from "./lib/brollReel.js";
import { GROUPED } from "../frontend/api/_lib/queue.js";

if (!hasCloudinary()) throw new Error("Cloudinary is required for admin previews");

const argv = process.argv.slice(2);
const requestedId = argv.includes("--id") ? argv[argv.indexOf("--id") + 1] : null;
const all = argv.includes("--all");
if (!requestedId && !all) throw new Error("Usage: node preview.js --id <Content_Queue_ID> or --all");

const { headers, rows } = await readTab("Content_Queue");
// --all builds only the posts waiting on the board (grouped in /admin/feed); --id builds any row
const targets = rows.filter((row) =>
  (requestedId ? row.ID === requestedId : GROUPED.test(row.ID) && ["Draft", "Approved"].includes(row.Status || "Draft")) &&
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
    // Format=Reel on a jobs post builds the reel publish.js will post as is (named jobreel.mp4);
    // everything else becomes white carousel slides
    const category = categoryForRow(row);
    let previewLinks;
    if (String(row.Format).toLowerCase() === "reel" && REEL_CATEGORIES.includes(category)) {
      const reel = await buildJobReel(row, outDir, { category });
      previewLinks = [await uploadVideo(reel.file, { folder: `beyondtheoffer/${row.ID}/preview`, publicId: "jobreel" })];
    } else {
      previewLinks = await uploadSlides(await renderPost(row, outDir, { category }), `${row.ID}/preview`);
    }
    const nextHeaders = headers.includes("Preview_Link") ? headers : await ensureColumns("Content_Queue", ["Preview_Link"]);
    await updateRow("Content_Queue", nextHeaders, row._row, { Preview_Link: previewLinks.join("\n") }, { raw: true });
    console.log(`Preview ready for ${row.ID}`);
  } catch (error) {
    console.error(`Preview failed for ${row.ID}: ${error.message}`);
  }
}

await closeBrowser();
