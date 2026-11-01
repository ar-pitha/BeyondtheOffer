import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env") });

// GOOGLE_SA_JSON_PATH in .env is relative to automation/
if (process.env.GOOGLE_SA_JSON_PATH && !path.isAbsolute(process.env.GOOGLE_SA_JSON_PATH)) {
  process.env.GOOGLE_SA_JSON_PATH = path.join(ROOT, process.env.GOOGLE_SA_JSON_PATH);
}

const args = new Set(process.argv.slice(2));
export const hasFlag = (name) => args.has(`--${name}`);
export const isDryRun = () => hasFlag("dry-run") || String(process.env.DRY_RUN).toLowerCase() === "true";

export const WEBSITE_URL = process.env.WEBSITE_URL || "https://beyondtheoffer.vercel.app";

export const TABS = {
  tech: "Tech_Jobs",
  govt: "Govt_Jobs",
  events: "Hackathons_Quizzes",
  news: "Tech_News",
  queue: "Content_Queue",
  runLog: "Run_Log",
  insights: "Insights",
};

export const RUN_LOG_HEADERS = [
  "Run_Date", "Run_Time_IST", "Tech_Added", "Govt_Added", "Hackathons_Added", "News_Added", "Marked_Expired", "Notes",
];
