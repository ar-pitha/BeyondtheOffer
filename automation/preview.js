import path from "node:path";
import { ROOT } from "./lib/config.js";
import { readTab, updateRow, ensureColumns } from "./lib/sheets.js";
import { renderSlides, closeBrowser, parseReelScript } from "./lib/render.js";
import { buildReel } from "./reels.js";
import { uploadSlides, uploadVideo, hasCloudinary } from "./lib/cloudinary.js";

const id = process.argv[process.argv.indexOf("--id") + 1];
if (!id) throw new Error("Usage: node preview.js --id <Content_Queue_ID>");

const { headers, rows } = await readTab("Content_Queue");
const row = rows.find((item) => item.ID === id);
if (!row) throw new Error(`No Content_Queue row with ID ${id}`);
if (!hasCloudinary()) throw new Error("Cloudinary is required for admin previews");

const outDir = path.join(ROOT, "renders", "preview", id);
let previewLinks;
try {
  if (String(row.Format).toLowerCase() === "reel") {
    const result = await buildReel(row.Slides_or_Script, outDir);
    previewLinks = [await uploadVideo(result.file, { folder: `beyondtheoffer/${id}/preview`, publicId: "reel" })];
  } else {
    const slides = String(row.Slides_or_Script || "").split(/\r?\n/).filter(Boolean);
    const images = await renderSlides(slides.map((text, index) => ({ text, fields: [text], variant: index === 0 ? "cover" : "item" })), outDir);
    previewLinks = await uploadSlides(images, `${id}/preview`);
  }
  const nextHeaders = await ensureColumns("Content_Queue", ["Preview_Link"]);
  await updateRow("Content_Queue", nextHeaders, row._row, { Preview_Link: previewLinks.join("\n") }, { raw: true });
  console.log(`Preview ready for ${id}`);
} finally {
  await closeBrowser();
}
