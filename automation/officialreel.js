// Local preview of an official-page reel (lib/officialReel.js). Only renders; never uploads or posts.
//   node officialreel.js scripts/<file>.official.json   → renders/story/<id>/reel.mp4
import path from "node:path";
import fs from "node:fs";
import { ROOT } from "./lib/config.js";
import { closeBrowser } from "./lib/render.js";
import { buildOfficialReel } from "./lib/officialReel.js";

try {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: node officialreel.js scripts/<file>.official.json");
  const script = JSON.parse(fs.readFileSync(file, "utf8"));
  const started = Date.now();
  const reel = await buildOfficialReel(script, path.join(ROOT, "renders", "story", script.id));
  const p = reel.parts;
  console.log(`Official reel ready: ${reel.file}`);
  console.log(`  ${reel.seconds.toFixed(1)}s (intro ${p.intro.toFixed(1)}s, page ${p.page.toFixed(1)}s, outro ${p.outro.toFixed(1)}s), voice ${reel.voice}, built in ${Math.round((Date.now() - started) / 1000)}s`);
} catch (err) {
  console.error(`official reel failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser();
}
