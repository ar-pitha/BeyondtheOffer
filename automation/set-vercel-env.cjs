// Copies the webhook settings from automation/.env (plus the Google key as
// GOOGLE_SA_JSON_B64) into the Vercel *frontend* project's Production env.
// Prints names only. Run from the repo root:
//   npx vercel login                      (once)
//   node automation/set-vercel-env.cjs
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = __dirname;
const frontend = path.join(dir, "..", "frontend");
const PROJECT = process.env.VERCEL_PROJECT || "beyondtheoffer";
const env = require(path.join(dir, "node_modules", "dotenv")).parse(fs.readFileSync(path.join(dir, ".env")));

const vars = {
  IG_WEBHOOK_VERIFY_TOKEN: env.IG_WEBHOOK_VERIFY_TOKEN,
  IG_APP_SECRET: env.IG_APP_SECRET,
  IG_ACCESS_TOKEN: env.IG_ACCESS_TOKEN,
  IG_USER_ID: env.IG_USER_ID,
  IG_API_BASE: env.IG_API_BASE,
  IG_API_VERSION: env.IG_API_VERSION,
  SHEET_ID: env.SHEET_ID,
  WEBSITE_URL: env.WEBSITE_URL,
  TIMEZONE: env.TIMEZONE,
  POST_SLOTS_IST: env.POST_SLOTS_IST,
  // Post now button in /admin/feed: fine-grained token, this repo only, Actions read and write
  GH_DISPATCH_TOKEN: env.GH_DISPATCH_TOKEN,
};
const keyFile = path.join(dir, "secrets", "google-sa.json");
if (fs.existsSync(keyFile)) vars.GOOGLE_SA_JSON_B64 = fs.readFileSync(keyFile).toString("base64");

const vercel = (args, input) =>
  spawnSync("npx", ["--yes", "vercel", ...args], { cwd: frontend, input, encoding: "utf8", shell: process.platform === "win32" });

// Link frontend/ to the existing Vercel project (creates frontend/.vercel, git-ignored by Vercel)
const link = vercel(["link", "--yes", "--project", PROJECT]);
if (link.status !== 0) {
  console.error(`Could not link to Vercel project "${PROJECT}". Run "npx vercel login" first.\n${(link.stderr || "").trim()}`);
  process.exit(1);
}
console.log(`Linked to Vercel project ${PROJECT}`);

for (const [name, value] of Object.entries(vars)) {
  if (!value || !value.trim()) {
    console.log(`skip ${name} (empty in automation/.env)`);
    continue;
  }
  vercel(["env", "rm", name, "production", "--yes"]); // replace if it already exists
  const r = vercel(["env", "add", name, "production"], value.trim());
  console.log(`${r.status === 0 ? "set " : "FAIL"} ${name}${r.status === 0 ? "" : `: ${(r.stderr || "").trim().split("\n").pop()}`}`);
}
console.log("\nVariables apply to the next deployment. Tell Claude to trigger a redeploy, or click Redeploy in Vercel.");
