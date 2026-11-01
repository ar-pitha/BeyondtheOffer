// Admin access to the "BeyondTheOffer Feed" Google Sheet from the website.
// GET  /api/admin-sheet?tab=Content_Queue        → { tab, headers, rows, editable }
// POST /api/admin-sheet { tab, id, patch }       → updates allowed columns of one row
//
// Only signed-in admins: the bearer token is checked against the backend's /api/auth/me.
// Env (frontend Vercel project): SHEET_ID, GOOGLE_SA_JSON_B64, and VITE_API_URL or ADMIN_API_URL.

import { readTab, updateRow, nowInZone } from "./_lib/sheets.js";

const STATUS_DATA = ["Active", "Expired"];
const VERIFIED = ["Official", "Multi-source", "Single-source"];

// What the admin panel may change, per tab. Anything else is read-only.
const TABS = {
  Content_Queue: {
    editable: {
      Status: (v) => ["Draft", "Approved", "Rejected"].includes(v),
      Scheduled_Time_IST: (v) => v === "" || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v),
      Caption: (v) => typeof v === "string" && v.length <= 2200,
      Hashtags: (v) => typeof v === "string" && v.length <= 600,
    },
  },
  Tech_Jobs: { editable: { Status: (v) => STATUS_DATA.includes(v), Verified: (v) => VERIFIED.includes(v) } },
  Govt_Jobs: { editable: { Status: (v) => STATUS_DATA.includes(v), Verified: (v) => VERIFIED.includes(v) } },
  Hackathons_Quizzes: { editable: { Status: (v) => STATUS_DATA.includes(v), Verified: (v) => VERIFIED.includes(v) } },
  Tech_News: { editable: {} },
  Run_Log: { editable: {}, newestFirst: true, limit: 60 },
  Comments_Log: { editable: {}, newestFirst: true, limit: 100 },
};

function backendBase() {
  const raw = process.env.ADMIN_API_URL || process.env.VITE_API_URL || "";
  return raw.replace(/\/+$/, "").replace(/\/api$/, "");
}

async function requireAdmin(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return false;
  const base = backendBase();
  if (!base) throw new Error("Backend URL not configured (set ADMIN_API_URL)");
  const res = await fetch(`${base}/api/auth/me`, { headers: { Authorization: auth } });
  if (!res.ok) return false;
  const user = await res.json().catch(() => null);
  return user?.role === "admin";
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  try {
    if (!(await requireAdmin(req))) return send(res, 401, { message: "Sign in as an admin to manage the feed." });

    if (req.method === "GET") {
      const q = req.query || Object.fromEntries(new URL(req.url, "http://x").searchParams);
      const tab = q.tab || "Content_Queue";
      const cfg = TABS[tab];
      if (!cfg) return send(res, 400, { message: `Unknown tab "${tab}"` });

      const { headers, rows } = await readTab(tab).catch((err) => {
        // Comments_Log is created by the webhook on its first comment
        if (/Unable to parse range|400/.test(err.message)) return { headers: [], rows: [] };
        throw err;
      });
      let list = cfg.newestFirst ? [...rows].reverse() : rows;
      if (cfg.limit) list = list.slice(0, cfg.limit);
      return send(res, 200, {
        tab,
        headers,
        rows: list,
        editable: Object.keys(cfg.editable),
        tabs: Object.keys(TABS),
        slots: process.env.POST_SLOTS_IST || "09:00,13:00,19:00",
        nowIST: nowInZone(),
      });
    }

    if (req.method === "POST") {
      const { tab, id, patch } = await readJson(req);
      const cfg = TABS[tab];
      if (!cfg) return send(res, 400, { message: `Unknown tab "${tab}"` });
      if (!id || !patch || typeof patch !== "object") return send(res, 400, { message: "Send a row id and the fields to change." });

      for (const [key, value] of Object.entries(patch)) {
        const valid = cfg.editable[key];
        if (!valid) return send(res, 400, { message: `${key} can't be changed from the admin panel.` });
        if (!valid(value)) return send(res, 400, { message: `"${value}" isn't a valid ${key}.` });
      }

      const { headers, rows } = await readTab(tab);
      const row = rows.find((r) => r.ID === id);
      if (!row) return send(res, 404, { message: `No row with ID ${id} in ${tab}.` });
      if (tab === "Content_Queue" && row.Status === "Published") {
        return send(res, 409, { message: "This post is already published and can't be changed here." });
      }

      await updateRow(tab, headers, row._row, patch, { raw: true });
      return send(res, 200, { row: { ...row, ...patch } });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { message: "Method not allowed" });
  } catch (err) {
    return send(res, 500, { message: err.message });
  }
}
