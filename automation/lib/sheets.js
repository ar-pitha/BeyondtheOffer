// Re-exports the shared helpers so the webhook and the scripts use one implementation.
export * from "../../frontend/api/_lib/sheets.js";

import { appendRow, ensureTab, nowInZone } from "../../frontend/api/_lib/sheets.js";
import { TABS, RUN_LOG_HEADERS } from "./config.js";

export async function logRun(notes, counts = {}) {
  await ensureTab(TABS.runLog, RUN_LOG_HEADERS);
  const { date, time } = nowInZone();
  await appendRow(TABS.runLog, RUN_LOG_HEADERS, {
    Run_Date: date,
    Run_Time_IST: time,
    ...counts,
    Notes: notes,
  });
}
