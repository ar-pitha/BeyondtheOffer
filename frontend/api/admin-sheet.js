// Admin access to the "BeyondTheOffer Feed" Google Sheet from the website.
// GET  /api/admin-sheet?tab=Content_Queue        → { tab, headers, rows, editable }
// POST /api/admin-sheet { tab, id, patch }       → updates allowed columns of one row
//
// Only signed-in admins: the bearer token is checked against the backend's /api/auth/me.
// Env (frontend Vercel project): SHEET_ID, GOOGLE_SA_JSON_B64, and VITE_API_URL or ADMIN_API_URL.

import { readTab, appendRow, updateRow, ensureTab, nowInZone } from "./_lib/sheets.js";
import { listUserMedia, listMediaComments, permalinkKey, sendPrivateReply, replyToComment } from "./_lib/instagram.js";
import { buildLinksMessage, buildPublicLinksReply, COMMENTS_LOG_TAB, COMMENTS_LOG_HEADERS, PUBLIC_LINKS_REPLY } from "./_lib/replies.js";

const WEBSITE_URL = process.env.WEBSITE_URL || "https://beyondtheoffer.vercel.app";

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
  Run_Log: { editable: {}, newestFirst: true },
  Comments_Log: { editable: {}, newestFirst: true },
};

// GitHub Actions (publish.yml) is where posts are rendered and published.
// GH_DISPATCH_TOKEN: fine-grained token for this repo with "Actions: Read and write".
const repo = () => process.env.GH_REPO || "ar-pitha/BeyondtheOffer";

async function github(path, init = {}) {
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    const err = new Error("Instant posting isn't set up yet: add GH_DISPATCH_TOKEN to the Vercel project.");
    err.status = 501;
    throw err;
  }
  const res = await fetch(`https://api.github.com/repos/${repo()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`GitHub ${res.status}: ${detail.slice(0, 200)}`);
    err.status = 502;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

const dispatchPublish = (id) =>
  github("/actions/workflows/publish.yml/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs: { dry_run: "false", id } }),
  });

async function latestPublishRun() {
  const { workflow_runs: runs = [] } = await github("/actions/workflows/publish.yml/runs?per_page=1");
  const r = runs[0];
  return r
    ? { status: r.status, conclusion: r.conclusion, url: r.html_url, startedAt: r.run_started_at, event: r.event }
    : { status: "none" };
}

async function syncInstagramComments() {
  await ensureTab(COMMENTS_LOG_TAB, COMMENTS_LOG_HEADERS);
  const [{ rows: queue }, { rows: existingRows }] = await Promise.all([
    readTab("Content_Queue"),
    readTab(COMMENTS_LOG_TAB).catch(() => ({ rows: [] })),
  ]);
  const known = new Set(existingRows.map((row) => row.Comment_ID).filter(Boolean));
  const links = new Set(queue.map((row) => row.IG_Post_Link).filter((link) => /^https?:\/\//.test(link)).map(permalinkKey));
  const media = (await listUserMedia()).data || [];
  const published = media.filter((item) => links.has(permalinkKey(item.permalink)));
  let imported = 0;
  let replied = 0;

  for (const post of published) {
    const comments = (await listMediaComments(post.id)).data || [];
    for (const comment of comments) {
      if (comment.from?.id === process.env.IG_USER_ID || comment.username === "beyond_the.offer") {
        continue;
      }
      const replies = comment.replies?.data || [];
      const existing = existingRows.find((row) => row.Comment_ID === comment.id);
      const alreadyReplied = replies.some((reply) => reply.from?.id === process.env.IG_USER_ID);
      if (existing?.Reply_Text || alreadyReplied) {
        known.add(comment.id);
        continue;
      }

      const queueRow = queue.find((row) => permalinkKey(row.IG_Post_Link) === permalinkKey(post.permalink));
      const ids = new Set((queueRow?.Item_IDs || "").split(/[,\s]+/).filter(Boolean));
      const tabs = [
        ["Tech_Jobs", (row) => [`${row.Role}, ${row.Company}`, row.Apply_Link]],
        ["Govt_Jobs", (row) => [`${row.Post_Exam}, ${row.Organisation}`, row.Official_Link || row.Notification_Link]],
        ["Hackathons_Quizzes", (row) => [row.Name, row.Link]],
        ["Tech_News", (row) => [row.Headline, row.Link]],
      ];
      const items = [];
      for (const [tab, pick] of tabs) {
        if (items.length === ids.size) break;
        const { rows } = await readTab(tab).catch(() => ({ rows: [] }));
        for (const row of rows) {
          if (ids.has(row.ID)) {
            const [label, link] = pick(row);
            items.push({ label, link });
          }
        }
      }

      let replyText = "";
      let status = "received";
      let dmError = "";
      try {
        const dm = buildLinksMessage(items, WEBSITE_URL, queueRow?.ID);
        try {
          await sendPrivateReply(comment.id, dm);
        } catch (error) {
          dmError = error.message.slice(0, 300);
        }
        const publicReply = dmError ? buildPublicLinksReply(items, WEBSITE_URL, queueRow?.ID) : PUBLIC_LINKS_REPLY;
        await replyToComment(comment.id, publicReply);
        replyText = `${publicReply} | ${dmError ? `DM failed: ${dmError}` : `DM: ${items.length} link(s)`}`;
        status = dmError ? "partial" : "sent";
        replied += 1;
      } catch (error) {
        replyText = `${dmError ? `DM failed: ${dmError} | ` : ""}Public reply failed: ${error.message.slice(0, 300)}`;
        status = "error";
      }

      const rowData = {
        Time_IST: comment.timestamp ? new Date(comment.timestamp).toISOString().slice(0, 16).replace("T", " ") : nowInZone().date,
        Comment_ID: comment.id,
        Media_ID: post.id,
        Username: comment.username || comment.from?.username || "",
        Text: (comment.text || "").slice(0, 500),
        Action: "links",
        Reply_Text: replyText.slice(0, 500),
        Status: status,
      };

      if (existing?._row) {
        await updateRow(COMMENTS_LOG_TAB, COMMENTS_LOG_HEADERS, existing._row, rowData, { raw: true });
      } else {
        await appendRow(COMMENTS_LOG_TAB, COMMENTS_LOG_HEADERS, rowData);
      }
      known.add(comment.id);
      imported += 1;
    }
  }

  return { imported, replied, posts: published.length };
}

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
      const body = await readJson(req);

      if (body.action === "sync-comments") {
        return send(res, 200, await syncInstagramComments());
      }

      // "Post now": start the publish workflow on GitHub for one approved row
      if (body.action === "publish-now") {
        const { rows } = await readTab("Content_Queue");
        const row = rows.find((r) => r.ID === body.id);
        if (!row) return send(res, 404, { message: `No post with ID ${body.id}.` });
        if (row.Status === "Published") return send(res, 409, { message: "This post is already published." });
        if (row.Status !== "Approved") {
          await updateRow("Content_Queue", (await readTab("Content_Queue")).headers, row._row, { Status: "Approved" }, { raw: true });
        }
        await dispatchPublish(row.ID);
        return send(res, 202, { message: "Posting started", runsUrl: `https://github.com/${repo()}/actions/workflows/publish.yml` });
      }

      // Latest publish run, so the page can show progress
      if (body.action === "publish-status") {
        return send(res, 200, await latestPublishRun());
      }

      const { tab, id, patch } = body;
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
    return send(res, err.status || 500, { message: err.message });
  }
}
