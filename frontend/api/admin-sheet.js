// Admin access to the "BeyondTheOffer Feed" Google Sheet from the website.
// GET  /api/admin-sheet?tab=Content_Queue        → { tab, headers, rows, editable }
// POST /api/admin-sheet { tab, id, patch }       → updates allowed columns of one row
//
// Only signed-in admins: the bearer token is checked against the backend's /api/auth/me.
// Env (frontend Vercel project): SHEET_ID, GOOGLE_SA_JSON_B64, and VITE_API_URL or ADMIN_API_URL.

import { readTab, appendRow, updateRow, ensureColumns, nowInZone } from "./_lib/sheets.js";
import { listUserMedia, listMediaComments, permalinkKey, replyToComment } from "./_lib/instagram.js";
import { thanksReply, PUBLIC_LINKS_REPLY, COMMENTS_LOG_TAB } from "./_lib/replies.js";
import { startCommentDm, prepareCommentsLog, sweepFollowReplies } from "./_lib/followgate.js";
import { planQueue } from "./_lib/queue.js";
import { CATEGORIES, GROUPED, buildBoard, checkGroup, carouselFields, nextGroupId, categoryOfId, takenBy } from "./_lib/carousel.js";

// The opening tabs the picker groups from, by tab name
async function openingTabs() {
  const tabs = Object.values(CATEGORIES).map((c) => c.tab);
  const read = await Promise.all(tabs.map((t) => readTab(t).catch(() => ({ rows: [] }))));
  return Object.fromEntries(tabs.map((t, i) => [t, read[i].rows]));
}

const WEBSITE_URL = process.env.WEBSITE_URL || "https://beyondtheoffer.vercel.app";

// Per post: the openings it keeps, the ones left off and why, and whether anything is left to
// post at all (see _lib/queue.js)
async function postPlan(queue) {
  const tabs = await Promise.all(
    ["Tech_Jobs", "Govt_Jobs", "Hackathons_Quizzes", "Tech_News"].map((t) => readTab(t).catch(() => ({ rows: [] })))
  );
  const items = new Map(tabs.flatMap((t) => t.rows).filter((r) => r.ID).map((r) => [r.ID, r]));
  return planQueue(queue, items);
}

// Why this post can't be approved or published, or "" when it can
async function blocked(queue, id) {
  const p = (await postPlan(queue))[id];
  if (!p?.state) return "";
  return `${p.state === "expired" ? "This post has expired." : "Nothing new is left in this post."} ${p.reason}`;
}

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
  Run_Log: { editable: {} },
  Comments_Log: { editable: {} },
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
    if (res.status === 401 || res.status === 403) {
      const err = new Error(
        `GitHub ${res.status}: GH_DISPATCH_TOKEN cannot dispatch workflows in ${repo()}. ` +
        `Update the token with repository access and Actions: Read and write permission.`
      );
      err.status = 502;
      throw err;
    }
    const err = new Error(`GitHub ${res.status}: ${detail.slice(0, 200)}`);
    err.status = 502;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

const dispatchPublish = (id, platform = "instagram") =>
  github("/actions/workflows/publish.yml/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs: { dry_run: "false", id, platform } }),
  });

const dispatchPreview = (id) =>
  github("/actions/workflows/instagram-preview.yml/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs: { id } }),
  });

// Clears a post's preview (and any posting confirmation tied to it) and starts a new build.
// If the build can't be started, the old preview is put back.
async function resetPreview(row) {
  const headers = await ensureColumns("Content_Queue", ["Preview_Link", "Publish_Confirmed"]);
  await updateRow("Content_Queue", headers, row._row, { Preview_Link: "", Publish_Confirmed: "" }, { raw: true });
  try {
    await dispatchPreview(row.ID);
  } catch (err) {
    const old = { Preview_Link: row.Preview_Link || "", Publish_Confirmed: row.Publish_Confirmed || "" };
    await updateRow("Content_Queue", headers, row._row, old, { raw: true }).catch(() => {});
    throw err;
  }
}

async function latestPublishRun() {
  const { workflow_runs: runs = [] } = await github("/actions/workflows/publish.yml/runs?per_page=1");
  const r = runs[0];
  return r
    ? { status: r.status, conclusion: r.conclusion, url: r.html_url, startedAt: r.run_started_at, event: r.event }
    : { status: "none" };
}

async function latestPreviewRun() {
  const { workflow_runs: runs = [] } = await github("/actions/workflows/instagram-preview.yml/runs?per_page=1");
  const r = runs[0];
  return r
    ? { status: r.status, conclusion: r.conclusion, url: r.html_url, startedAt: r.run_started_at }
    : { status: "none" };
}

async function syncInstagramComments() {
  const logHeaders = await prepareCommentsLog();
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
      // The webhook answers within seconds; give it 45 so the two never answer the same comment.
      // By then its reply shows up under the comment and this skips it.
      const webhookFirst = Date.now() - Date.parse(comment.timestamp) < 45000;
      if (existing?.Reply_Text || alreadyReplied || webhookFirst) {
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

      // Same as the webhook: DM first (follow check, _lib/followgate.js), then a public reply
      // that points to the DM, or is a plain thank-you when the DM couldn't be sent
      const dm = await startCommentDm({ commentId: comment.id, items, websiteUrl: WEBSITE_URL, postId: queueRow?.ID });
      if (dm.duplicate) continue; // the webhook is answering this one
      const publicReply = dm.ok ? PUBLIC_LINKS_REPLY : thanksReply(comment.id);
      let replyText = "";
      let status = "received";
      try {
        await replyToComment(comment.id, publicReply);
        replyText = dm.ok ? publicReply : `${publicReply} (DM failed: ${dm.error})`;
        status = dm.ok ? dm.status : "partial";
        replied += 1;
      } catch (error) {
        replyText = `Public reply failed: ${error.message.slice(0, 300)}`;
        status = dm.ok ? dm.status : "error";
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
        IG_Scoped_ID: dm.recipientId,
        Post_ID: queueRow?.ID || "",
      };

      if (existing?._row) {
        await updateRow(COMMENTS_LOG_TAB, logHeaders, existing._row, rowData, { raw: true });
      } else {
        await appendRow(COMMENTS_LOG_TAB, logHeaders, rowData);
      }
      known.add(comment.id);
      imported += 1;
    }
  }

  // DONE replies the webhook never received
  const follow = await sweepFollowReplies({ websiteUrl: WEBSITE_URL }).catch((err) => ({ errors: [err.message.slice(0, 200)] }));
  return { imported, replied, posts: published.length, follow };
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
    let body = null;
    if (req.method === "POST") body = await readJson(req);

    // Vercel cron (frontend/vercel.json), a backup for daily-news.yml's own schedule: starts the
    // daily tech news run, which posts at 17:00 IST or stops if today's post is already out.
    // Vercel sends CRON_SECRET as a bearer token; without that env var this does nothing.
    const query = req.query || Object.fromEntries(new URL(req.url, "http://x").searchParams);
    if (query.cron === "daily-news") {
      if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return send(res, 401, { message: "Not allowed." });
      }
      await github("/actions/workflows/daily-news.yml/dispatches", {
        method: "POST",
        body: JSON.stringify({ ref: "main", inputs: { dry_run: "false" } }),
      });
      return send(res, 202, { message: "Daily news run started" });
    }

    const isScheduledCommentSync =
      body?.action === "sync-comments" &&
      process.env.INSTAGRAM_SYNC_SECRET &&
      req.headers["x-instagram-sync-secret"] === process.env.INSTAGRAM_SYNC_SECRET;
    if (!isScheduledCommentSync && !(await requireAdmin(req))) {
      return send(res, 401, { message: "Sign in as an admin to manage the feed." });
    }

    if (req.method === "GET") {
      const q = req.query || Object.fromEntries(new URL(req.url, "http://x").searchParams);
      // The whole Instagram board: openings, posts, published, rejected, expired (_lib/carousel.js)
      if (q.view === "board") {
        const [{ rows: queue }, tabRows] = await Promise.all([readTab("Content_Queue"), openingTabs()]);
        return send(res, 200, buildBoard(queue, tabRows));
      }
      const tab = q.tab || "Content_Queue";
      const cfg = TABS[tab];
      if (!cfg) return send(res, 400, { message: `Unknown tab "${tab}"` });

      const { headers, rows } = await readTab(tab).catch((err) => {
        // Comments_Log is created by the webhook on its first comment
        if (/Unable to parse range|400/.test(err.message)) return { headers: [], rows: [] };
        throw err;
      });
      // Rows are appended at the bottom of every tab, so newest first is the reverse
      let list = [...rows].reverse();
      if (cfg.limit) list = list.slice(0, cfg.limit);
      if (tab === "Content_Queue") {
        const plan = await postPlan(rows);
        list = list.map((r) => {
          const p = plan[r.ID];
          if (!p) return r;
          return { ...r, _state: p.state, _reason: p.reason, _dropped: p.dropped.map((d) => `${d.label} (${d.why})`) };
        });
      }
      return send(res, 200, {
        tab,
        headers,
        rows: list,
        editable: Object.keys(cfg.editable),
        tabs: Object.keys(TABS),
        slots: process.env.POST_SLOTS_IST || "19:00",
        nowIST: nowInZone(),
      });
    }

    if (req.method === "POST") {
      if (body.action === "sync-comments") {
        return send(res, 200, await syncInstagramComments());
      }

      // Openings picked on the board become one post, and its preview starts building at once
      if (body.action === "create-carousel") {
        const [{ headers, rows: queue }, tabRows] = await Promise.all([readTab("Content_Queue"), openingTabs()]);
        let group;
        try {
          group = checkGroup(body.ids, queue, tabRows);
        } catch (err) {
          return send(res, 409, { message: err.message });
        }
        const { date } = nowInZone();
        const row = { ID: nextGroupId(queue, date), Date: date, Format: "Carousel", Status: "Draft", ...carouselFields(group.category, group.items) };
        await appendRow("Content_Queue", headers, row);
        // instagram-preview.yml also builds it on its next 5-minute run if this dispatch fails
        const previewStarted = await dispatchPreview(row.ID).then(() => true, () => false);
        return send(res, 201, { row, previewStarted });
      }

      // Reject or restore openings on the board. A rejected opening is never offered for a post
      // again (IG_Rejected=Y in its tab); the website keeps showing it.
      if (body.action === "reject-openings" || body.action === "restore-openings") {
        const reject = body.action === "reject-openings";
        const ids = [...new Set((body.ids || []).map(String))];
        if (!ids.length) return send(res, 400, { message: "Send the openings to change." });
        const [{ rows: queue }, tabRows] = await Promise.all([readTab("Content_Queue"), openingTabs()]);
        if (reject) {
          const owner = takenBy(queue, new Map(Object.values(tabRows).flat().filter((r) => r.ID).map((r) => [r.ID, r])));
          const held = ids.filter((id) => owner.has(id));
          if (held.length) return send(res, 409, { message: `${held.join(", ")} ${held.length === 1 ? "is" : "are"} in ${owner.get(held[0])}. Ungroup that post first.` });
        }
        for (const id of ids) {
          const cfg = CATEGORIES[categoryOfId(id)];
          const row = cfg && tabRows[cfg.tab].find((r) => r.ID === id);
          if (!row) return send(res, 404, { message: `No opening with ID ${id}.` });
          const headers = await ensureColumns(cfg.tab, ["IG_Rejected"]);
          await updateRow(cfg.tab, headers, row._row, { IG_Rejected: reject ? "Y" : "" }, { raw: true });
        }
        return send(res, 200, { ids, rejected: reject });
      }

      // Ungroup a post that isn't out yet: its openings go back to the board
      if (body.action === "ungroup" || body.action === "regroup") {
        const { headers, rows } = await readTab("Content_Queue");
        const row = rows.find((r) => r.ID === body.id);
        if (!row || !GROUPED.test(row.ID)) return send(res, 404, { message: `No grouped post with ID ${body.id}.` });
        if (row.Status === "Published") return send(res, 409, { message: "This post is already published." });
        if (body.action === "regroup") {
          // Undo of an ungroup: only if none of its openings were picked for another post since
          const tabRows = await openingTabs();
          const owner = takenBy(rows, new Map(Object.values(tabRows).flat().filter((r) => r.ID).map((r) => [r.ID, r])));
          const ids = String(row.Item_IDs || "").split(/[,\s]+/).filter(Boolean);
          const held = ids.find((id) => owner.has(id));
          if (held) return send(res, 409, { message: `${held} is in ${owner.get(held)} now.` });
        }
        await updateRow("Content_Queue", headers, row._row, { Status: body.action === "ungroup" ? "Rejected" : "Draft" }, { raw: true });
        return send(res, 200, { id: row.ID });
      }

      if (body.action === "preview-now") {
        const { rows } = await readTab("Content_Queue");
        if (!rows.some((r) => r.ID === body.id)) return send(res, 404, { message: `No post with ID ${body.id}.` });
        await dispatchPreview(body.id);
        return send(res, 202, { message: "Preview generation started" });
      }

      // Throws away the current preview and builds a new one in its place
      if (body.action === "regenerate-preview") {
        const { rows } = await readTab("Content_Queue");
        const row = rows.find((r) => r.ID === body.id);
        if (!row) return send(res, 404, { message: `No post with ID ${body.id}.` });
        if (row.Status === "Published") return send(res, 409, { message: "This post is already published." });
        await resetPreview(row);
        return send(res, 202, { message: "Building a new preview", row: { ...row, Preview_Link: "", Publish_Confirmed: "" } });
      }

      if (body.action === "preview-status") {
        return send(res, 200, await latestPreviewRun());
      }

      // "Post now": start the publish workflow on GitHub for one approved row
      if (body.action === "publish-now") {
        const { rows } = await readTab("Content_Queue");
        const row = rows.find((r) => r.ID === body.id);
        if (!row) return send(res, 404, { message: `No post with ID ${body.id}.` });
        if (row.Status === "Published") return send(res, 409, { message: "This post is already published." });
        if (!row.Preview_Link) return send(res, 409, { message: "Generate and review the preview before posting." });
        const why = await blocked(rows, row.ID);
        if (why) return send(res, 409, { message: why });
        const headers = await ensureColumns("Content_Queue", ["Preview_Link", "Publish_Confirmed"]);
        if (row.Status !== "Approved") {
          await updateRow("Content_Queue", headers, row._row, { Status: "Approved", Publish_Confirmed: "Y" }, { raw: true });
        } else {
          await updateRow("Content_Queue", headers, row._row, { Publish_Confirmed: "Y" }, { raw: true });
        }

        await dispatchPublish(row.ID);
        return send(res, 202, { message: "Posting started", runsUrl: `https://github.com/${repo()}/actions/workflows/publish.yml` });
      }

      // "Publish to YouTube": reels only, independent of the Instagram post
      if (body.action === "publish-youtube") {
        const { rows } = await readTab("Content_Queue");
        const row = rows.find((r) => r.ID === body.id);
        if (!row) return send(res, 404, { message: `No post with ID ${body.id}.` });
        if (String(row.Format).toLowerCase() !== "reel") return send(res, 409, { message: "Only reels can go to YouTube." });
        if (!["Approved", "Published"].includes(row.Status)) return send(res, 409, { message: "Approve this reel first." });
        if (row.YT_Video_Link) return send(res, 409, { message: "This reel is already on YouTube." });
        if (!/\.mp4(\?|\s|$)/i.test(row.Preview_Link || "")) return send(res, 409, { message: "Generate and review the preview before posting." });
        await dispatchPublish(row.ID, "youtube");
        return send(res, 202, { message: "YouTube upload started" });
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
      if (tab === "Content_Queue" && patch.Status === "Approved") {
        const why = await blocked(rows, id);
        if (why) return send(res, 409, { message: why });
      }

      await updateRow(tab, headers, row._row, patch, { raw: true });

      // Approving a post always builds a fresh preview of it
      if (tab === "Content_Queue" && patch.Status === "Approved" && row.Status !== "Approved") {
        const previewError = await resetPreview(row).then(() => null, (err) => err.message);
        const fresh = previewError ? {} : { Preview_Link: "", Publish_Confirmed: "" };
        return send(res, 200, { row: { ...row, ...patch, ...fresh }, previewStarted: !previewError, previewError });
      }
      return send(res, 200, { row: { ...row, ...patch } });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { message: "Method not allowed" });
  } catch (err) {
    return send(res, err.status || 500, { message: err.message });
  }
}
