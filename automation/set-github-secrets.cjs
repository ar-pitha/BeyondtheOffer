// Copies automation/.env (plus the Google key as GOOGLE_SA_JSON_B64) into
// GitHub Actions secrets for ar-pitha/BeyondtheOffer. Prints key names only.
// Run from the repo root:  node automation/set-github-secrets.cjs
// Only some keys (nothing else is touched, DRY_RUN included):
//   node automation/set-github-secrets.cjs YT_CLIENT_ID YT_CLIENT_SECRET YT_REFRESH_TOKEN
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = __dirname;
const REPO = process.env.REPO || "ar-pitha/BeyondtheOffer";
const env = require(path.join(dir, "node_modules", "dotenv")).parse(fs.readFileSync(path.join(dir, ".env")));
const KEYS = [
  "MONGO_URI", "AUTOMATION_USER_EMAIL", "SHEET_ID",
  "IG_USER_ID", "IG_ACCESS_TOKEN", "IG_TOKEN_ISSUED_AT", "IG_APP_ID", "IG_APP_SECRET", "IG_API_BASE", "IG_API_VERSION",
  "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
  "YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN",
];

const only = process.argv.slice(2);
const unknown = only.filter((k) => !KEYS.includes(k));
if (unknown.length) throw new Error(`Unknown key(s): ${unknown.join(", ")}`);
const secrets = {};
for (const k of only.length ? only : KEYS) if (env[k] && env[k].trim()) secrets[k] = env[k].trim();
const keyFile = path.join(dir, "secrets", "google-sa.json");
if (!only.length && fs.existsSync(keyFile)) secrets.GOOGLE_SA_JSON_B64 = fs.readFileSync(keyFile).toString("base64");

for (const [name, value] of Object.entries(secrets)) {
  // Value goes through stdin so it never appears in the process list
  const r = spawnSync("gh", ["secret", "set", name, "-R", REPO], { input: value, encoding: "utf8" });
  console.log(`${r.status === 0 ? "set " : "FAIL"} ${name}${r.status === 0 ? "" : `: ${r.stderr.trim()}`}`);
}
if (!only.length) {
  const v = spawnSync("gh", ["variable", "set", "DRY_RUN", "--body", "true", "-R", REPO], { encoding: "utf8" });
  console.log(`${v.status === 0 ? "set " : "FAIL"} variable DRY_RUN=true`);
}

const missing = (only.length ? only : KEYS).filter((k) => !secrets[k]);
if (missing.length) console.log(`\nStill empty in automation/.env (fill in, then run again): ${missing.join(", ")}`);
