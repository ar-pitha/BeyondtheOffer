// Public, read-only: the apply links behind one Instagram post.
// GET /api/post-links?id=CQ-20261101-01   or   ?id=latest (newest published post)
// Used by the /links/:id page, which comment-to-DM tools (ManyChat, saved replies) link to.
// Only public listing info is returned: titles, organisations, deadlines and official links.

import { readTab } from "./_lib/sheets.js";

const SOURCES = [
  ["Tech_Jobs", "tech", (r) => ({ title: r.Role, org: r.Company, link: r.Apply_Link, deadline: r.Apply_By, detail: [r.Eligibility_Batch, r.Location, r.Salary_Stipend].filter(Boolean).join(" · ") })],
  ["Govt_Jobs", "govt", (r) => ({ title: r.Post_Exam, org: r.Organisation, link: r.Official_Link || r.Notification_Link, deadline: r.Last_Date, detail: [r.Vacancies && `${r.Vacancies} posts`, r.Qualification].filter(Boolean).join(" · ") })],
  ["Hackathons_Quizzes", "event", (r) => ({ title: r.Name, org: r.Organiser, link: r.Link, deadline: r.Register_By, detail: [r.Type, r.Prizes_Perks].filter(Boolean).join(" · ") })],
  ["Tech_News", "news", (r) => ({ title: r.Headline, org: r.Source, link: r.Link, deadline: "", detail: r.Topic || "" })],
];

const send = (res, status, body, cache = true) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  // Cache at Vercel's edge for 5 minutes so a viral post doesn't hammer the Sheets API
  res.setHeader("Cache-Control", cache ? "public, s-maxage=300, stale-while-revalidate=600" : "no-store");
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { message: "Method not allowed" }, false);
  try {
    const q = req.query || Object.fromEntries(new URL(req.url, "http://x").searchParams);
    const id = String(q.id || "latest").trim();
    if (id !== "latest" && !/^[A-Za-z0-9_-]{3,40}$/.test(id)) return send(res, 400, { message: "Invalid post id" }, false);

    const { rows } = await readTab("Content_Queue");
    const live = rows.filter((r) => r.Status === "Published" || r.Status === "Approved");
    let row =
      id === "latest"
        ? live.filter((r) => r.Status === "Published").sort((a, b) => (b.Date || "").localeCompare(a.Date || "") || b._row - a._row)[0]
        : live.find((r) => r.ID === id);
    // Accept a shortened CQ-YYYY prefix when it identifies a published post.
    // Exact IDs remain preferred for post-specific links.
    if (!row && id !== "latest") {
      row = live
        .filter((r) => r.ID && String(r.ID).startsWith(id))
        .sort((a, b) => (b.Date || "").localeCompare(a.Date || "") || b._row - a._row)[0];
    }
    if (!row) return send(res, 404, { message: "We couldn't find that post. All current openings are on the Jobs page." }, false);

    const ids = (row.Item_IDs || "").split(/[,\s]+/).filter(Boolean);
    const items = [];
    for (const [tab, kind, pick] of SOURCES) {
      if (items.length === ids.length) break;
      const { rows: data } = await readTab(tab).catch(() => ({ rows: [] }));
      for (const r of data) {
        if (!ids.includes(r.ID)) continue;
        const item = pick(r);
        if (item.link) items.push({ id: r.ID, kind, ...item, status: r.Status || "Active" });
      }
    }
    // Keep the order the post used
    items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

    return send(res, 200, {
      id: row.ID,
      title: row.Title,
      format: row.Format,
      date: row.Date,
      instagram: row.IG_Post_Link?.startsWith("http") ? row.IG_Post_Link : null,
      items,
    });
  } catch (err) {
    return send(res, 500, { message: "Links are unavailable right now. Try again in a minute." }, false);
  }
}
