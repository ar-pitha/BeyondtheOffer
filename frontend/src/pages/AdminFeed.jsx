import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { HiExternalLink, HiRefresh } from "react-icons/hi";
import Loader from "../components/Loader";
import usePageMeta from "../hooks/usePageMeta";
import Pagination from "../components/Pagination";

// The admin sheet API is a Vercel function on this site, not the backend API
const api = { baseURL: "" };

const TAB_LABELS = {
  Content_Queue: "Instagram posts",
  Tech_Jobs: "Tech jobs",
  Govt_Jobs: "Govt jobs",
  Hackathons_Quizzes: "Hackathons",
  Tech_News: "Tech news",
  Run_Log: "Run log",
  Comments_Log: "Comment replies",
};

const POST_FILTERS = [
  { value: "Draft", label: "To review" },
  { value: "Approved", label: "Approved" },
  { value: "Published", label: "Published" },
  { value: "Rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const SELECT_OPTIONS = {
  Status: ["Active", "Expired"],
  Verified: ["Official", "Multi-source", "Single-source"],
};

// "Slide 2: A | B | C" lines → [{ n, text }]
const parseSlides = (script = "") =>
  script
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(?:slide\s*\d+|hook|point|cta)\s*(?:\([^)]*\))?\s*[:.\-–]\s*(.*)$/i);
      return (m ? m[1] : l).split("|").map((s) => s.trim()).filter(Boolean).join(" · ");
    });

const PLATFORMS = {
  instagram: { name: "Instagram", action: "publish-now" },
  youtube: { name: "YouTube", action: "publish-youtube" },
};

// Reels are the only format that goes to YouTube, and it uploads the approved preview video
const canPublishToYouTube = (row) =>
  String(row.Format).toLowerCase() === "reel" && !row.YT_Video_Link && /\.mp4(\?|\s|$)/i.test(row.Preview_Link || "");

const toInputTime = (v) => (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v || "") ? v.replace(" ", "T") : "");
const fromInputTime = (v) => (v ? v.replace("T", " ").slice(0, 16) : "");

function PostCard({ row, slots, onSave, onApprove, onPublish, onPreview, onRegenerate, building, busy, postingTo }) {
  const [time, setTime] = useState(toInputTime(row.Scheduled_Time_IST));
  const [caption, setCaption] = useState(row.Caption || "");
  const [editing, setEditing] = useState(false);
  const slides = parseSlides(row.Slides_or_Script);
  const published = row.Status === "Published";
  const status = row.Status || "Draft";

  const save = (patch, done) => onSave(row.ID, patch, done);

  const youTubeAction = row.YT_Video_Link ? (
    <a className="btn btn-secondary btn-sm" href={row.YT_Video_Link} target="_blank" rel="noopener noreferrer">
      View on YouTube <HiExternalLink aria-hidden />
    </a>
  ) : canPublishToYouTube(row) ? (
    <button className="btn btn-primary btn-sm" disabled={busy || !!postingTo} onClick={() => onPublish(row, "youtube")}>
      {postingTo === "youtube" ? "Uploading…" : "Publish to YouTube"}
    </button>
  ) : null;

  return (
    <article className={`feed-card status-${status.toLowerCase()}`}>
      <header className="feed-card-head">
        <div className="ticket-tags">
          <span className="tag tag-kind">{row.Format || "Post"}</span>
          <span className={`tag feed-status-${status.toLowerCase()}`}>{status}</span>
          {row.Scheduled_Time_IST && !published && <span className="tag">Posts at {row.Scheduled_Time_IST} IST</span>}
        </div>
        <small>{row.ID} · {row.Date}</small>
      </header>

      <h3 className="ticket-title">{row.Title || "Untitled post"}</h3>

      <ol className="feed-slides">
        {slides.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <details className="feed-caption" open={editing}>
        <summary>Caption and hashtags</summary>
        {editing ? (
          <>
            <textarea className="form-control" rows={8} value={caption} onChange={(e) => setCaption(e.target.value)} />
            <div className="feed-row">
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => save({ Caption: caption }, "Caption saved").then(() => setEditing(false))}>
                Save caption
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setCaption(row.Caption || ""); setEditing(false); }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="feed-caption-text">{row.Caption}</p>
            <p className="feed-hashtags">{row.Hashtags}</p>
            {!published && (
              <button className="link-button" onClick={() => setEditing(true)}>Edit caption</button>
            )}
          </>
        )}
      </details>

      {published ? (
        <div className="feed-actions">
          {row.IG_Post_Link?.startsWith("http") ? (
            <a className="btn btn-secondary btn-sm" href={row.IG_Post_Link} target="_blank" rel="noopener noreferrer">
              View on Instagram <HiExternalLink aria-hidden />
            </a>
          ) : (
            <span className="stat-note">{row.IG_Post_Link || "Published"}</span>
          )}
          {youTubeAction}
          {row.Design_Link && (
            <a className="link-button" href={row.Design_Link} target="_blank" rel="noopener noreferrer">First slide image</a>
          )}
        </div>
      ) : (
        <div className="feed-actions">
          {status === "Approved" ? (
            <>
              {building && !row.Preview_Link ? (
                <button className="btn btn-secondary btn-sm" disabled>Building preview…</button>
              ) : (
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onPreview(row)}>
                  {row.Preview_Link ? "View preview" : "Generate preview"}
                </button>
              )}
              {row.Preview_Link && (
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onRegenerate(row)}>
                  Regenerate preview
                </button>
              )}
              <button className="btn btn-primary btn-sm" disabled={busy || !!postingTo || !row.Preview_Link} onClick={() => onPublish(row, "instagram")}>
                {postingTo === "instagram" ? "Posting…" : "Publish to Instagram"}
              </button>
              {youTubeAction}
            </>
          ) : (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onApprove(row)}>
              Approve
            </button>
          )}
          {status !== "Rejected" && (
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => save({ Status: "Rejected" }, "Rejected. It won't be posted.")}>
              Reject
            </button>
          )}
          {status !== "Draft" && (
            <button className="link-button" disabled={busy} onClick={() => save({ Status: "Draft", Scheduled_Time_IST: "" }, "Moved back to drafts")}>
              Back to draft
            </button>
          )}
          <label className="feed-time">
            <span>Post at</span>
            <input type="datetime-local" className="form-control" value={time} onChange={(e) => setTime(e.target.value)} />
            <button
              className="btn btn-secondary btn-sm"
              disabled={busy || fromInputTime(time) === (row.Scheduled_Time_IST || "")}
              onClick={() =>
                save(
                  { Scheduled_Time_IST: fromInputTime(time), ...(time && status !== "Approved" ? { Status: "Approved" } : {}) },
                  time ? `Scheduled for ${fromInputTime(time)} IST` : "Schedule cleared; it will use the next slot"
                )
              }
            >
              {time ? "Schedule" : "Clear time"}
            </button>
          </label>
        </div>
      )}
    </article>
  );
}

function SheetTable({ data, onSave, busy, order }) {
  const { headers, editable } = data;
  const rows = order === "oldest" ? [...data.rows].reverse() : data.rows;
  const [page, setPage] = useState(1);
  const visibleRows = rows.slice((page - 1) * 10, page * 10);
  const cleanCommentReply = (value) => {
    const match = String(value || "").match(/https:\/\/beyondtheoffer\.vercel\.app\/links\/[A-Za-z0-9_-]+/);
    return match ? match[0] : value;
  };

  useEffect(() => {
    setPage(1);
  }, [data.tab, order]);

  if (!rows.length) {
    return (
      <div className="empty-state">
        <h3>Nothing here yet</h3>
        <p>Rows appear as soon as the daily task or the webhook writes them.</p>
      </div>
    );
  }
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table feed-table">
        <thead>
          <tr>{headers.map((h) => <th key={h}>{h.replace(/_/g, " ")}</th>)}</tr>
        </thead>
        <tbody>
          {visibleRows.map((r, i) => (
            <tr key={r.ID || i} className={r.Status === "Expired" ? "is-off" : ""}>
              {headers.map((h) => (
                <td key={h}>
                  {editable.includes(h) && SELECT_OPTIONS[h] && r.ID ? (
                    <select
                      className="form-control feed-cell-select"
                      value={r[h]}
                      disabled={busy}
                      onChange={(e) => onSave(r.ID, { [h]: e.target.value }, `${r.ID}: ${h} set to ${e.target.value}`)}
                      aria-label={`${h} for ${r.ID}`}
                    >
                      {!SELECT_OPTIONS[h].includes(r[h]) && <option value={r[h]}>{r[h] || "—"}</option>}
                      {SELECT_OPTIONS[h].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : /^https?:\/\//.test(data.tab === "Comments_Log" && h === "Reply_Text" ? cleanCommentReply(r[h]) : r[h]) ? (
                    <a href={data.tab === "Comments_Log" && h === "Reply_Text" ? cleanCommentReply(r[h]) : r[h]} target="_blank" rel="noopener noreferrer" className="link-button">Open</a>
                  ) : (
                    <span className="feed-cell" title={r[h]}>
                      {data.tab === "Comments_Log" && h === "Status" && ["partial", "error"].includes(r[h]) && /DM failed/i.test(r.Reply_Text || "") ? "sent" : r[h]}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} total={rows.length} onChange={setPage} />
    </div>
  );
}

function AdminFeed() {
  usePageMeta("Instagram");
  const [tab, setTab] = useState("Content_Queue");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("Draft");
  const [order, setOrder] = useState("newest"); // the API sends rows newest first
  const [run, setRun] = useState(null); // { id, platform, status, conclusion, url }
  const [postPage, setPostPage] = useState(1);
  const [previewRow, setPreviewRow] = useState(null);
  const [previewRun, setPreviewRun] = useState(null);
  const [building, setBuilding] = useState({}); // post ID → when its preview build started

  const load = useCallback(async (t = tab) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get("/api/admin-sheet", { ...api, params: { tab: t } });
      setData(data);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load the sheet. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const onSave = async (id, patch, doneMessage) => {
    setBusy(true);
    try {
      const { data: res } = await axios.post("/api/admin-sheet", { tab, id, patch }, api);
      setData((d) => ({ ...d, rows: d.rows.map((r) => (r.ID === id ? { ...r, ...res.row } : r)) }));
      toast.success(doneMessage || "Saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // Starts a GitHub publish run for one platform once the approved post has a preview
  const onPublish = async (row, platform) => {
    setRun({ id: row.ID, platform, status: "starting" });
    try {
      await axios.post("/api/admin-sheet", { action: PLATFORMS[platform].action, id: row.ID }, api);
      toast.success(`Publishing to ${PLATFORMS[platform].name} started. This takes about 2 minutes.`);
    } catch (err) {
      setRun(null);
      toast.error(err.response?.data?.message || "Couldn't start posting.");
    }
  };

  const markBuilding = (id) => setBuilding((b) => ({ ...b, [id]: Date.now() }));
  const updateRowLocally = (row) => setData((d) => ({ ...d, rows: d.rows.map((r) => (r.ID === row.ID ? { ...r, ...row } : r)) }));

  // Starts a preview build, unless one for this post started in the last 15 minutes
  const startPreview = async (id) => {
    if (Date.now() - (building[id] || 0) > 15 * 60_000) {
      await axios.post("/api/admin-sheet", { action: "preview-now", id }, api);
      markBuilding(id);
    }
    setPreviewRun({ id, status: "waiting" });
  };

  // Approving builds a fresh preview on the server (any earlier one is replaced)
  const onApprove = async (row) => {
    setBusy(true);
    try {
      const { data: res } = await axios.post("/api/admin-sheet", { tab, id: row.ID, patch: { Status: "Approved" } }, api);
      updateRowLocally(res.row);
      if (res.previewStarted === false) {
        toast.error(`Approved, but the preview didn't start. ${res.previewError || "Use Generate preview."}`, { duration: 8000 });
      } else {
        markBuilding(row.ID);
        toast.success("Approved. Building the preview (about 5 minutes).");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't approve. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // Replaces the current preview with a newly built one
  const onRegenerate = async (row) => {
    setBusy(true);
    try {
      const { data: res } = await axios.post("/api/admin-sheet", { action: "regenerate-preview", id: row.ID }, api);
      updateRowLocally(res.row);
      markBuilding(row.ID);
      toast.success("Building a new preview (about 5 minutes).");
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't start a new preview.");
    } finally {
      setBusy(false);
    }
  };

  // While previews are building, check every 20 s and swap them in when ready
  const buildingIds = Object.keys(building).join(",");
  useEffect(() => {
    if (!buildingIds || tab !== "Content_Queue") return;
    const timer = setInterval(async () => {
      try {
        const { data: fresh } = await axios.get("/api/admin-sheet", { ...api, params: { tab: "Content_Queue" } });
        setData(fresh);
        const ready = fresh.rows.filter((r) => building[r.ID] && r.Preview_Link);
        ready.forEach((r) => toast.success(`Preview ready: ${r.Title || r.ID}`));
        setBuilding((b) => {
          const next = { ...b };
          for (const id of Object.keys(next)) {
            if (ready.some((r) => r.ID === id) || Date.now() - next[id] > 20 * 60_000) delete next[id];
          }
          return next;
        });
      } catch {
        /* keep waiting */
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [buildingIds, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Always shows the newest preview: re-reads the row first, and builds it now if it's missing
  const onPreview = async (row) => {
    setPreviewRow(row);
    setPreviewRun({ id: row.ID, status: "loading" });
    try {
      const { data: fresh } = await axios.get("/api/admin-sheet", { ...api, params: { tab: "Content_Queue" } });
      const latest = fresh.rows.find((r) => r.ID === row.ID) || row;
      setData(fresh);
      setPreviewRow(latest);
      if (latest.Preview_Link) {
        setPreviewRun(null);
        return;
      }
      await startPreview(row.ID);
      toast("Building the preview. It appears here in about 5 minutes.");
    } catch (err) {
      setPreviewRun(null);
      toast.error(err.response?.data?.message || "Couldn't load the preview.");
    }
  };

  const onSyncComments = async () => {
    setBusy(true);
    try {
      const { data: result } = await axios.post("/api/admin-sheet", { action: "sync-comments" }, api);
      toast.success(`Imported ${result.imported} existing comment${result.imported === 1 ? "" : "s"}.`);
      await load("Comments_Log");
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't sync Instagram comments.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!run || run.status === "completed") return;
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const { data: s } = await axios.post("/api/admin-sheet", { action: "publish-status" }, api);
        // Ignore the previous run until GitHub registers the new one
        if (s.startedAt && new Date(s.startedAt).getTime() < started - 60_000) return;
        setRun((r) => ({ ...r, ...s }));
        if (s.status === "completed") {
          clearInterval(timer);
          if (s.conclusion === "success") toast.success(`Published to ${PLATFORMS[run.platform].name}`);
          else toast.error(`Publishing to ${PLATFORMS[run.platform].name} failed. Open the run for details.`);
          load("Content_Queue");
        }
      } catch {
        /* keep polling */
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [run?.id, run?.status === "completed"]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!previewRun || previewRun.status !== "waiting") return;
    const timer = setInterval(async () => {
      try {
        const result = await axios.get("/api/admin-sheet", { ...api, params: { tab: "Content_Queue" } });
        const updated = result.data.rows.find((item) => item.ID === previewRow?.ID);
        if (updated?.Preview_Link) {
          clearInterval(timer);
          setPreviewRow(updated);
          setData(result.data);
          setPreviewRun({ id: updated.ID, status: "completed" });
          toast.success("Generated preview is ready.");
        }
      } catch {
        /* keep waiting */
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [previewRun?.status, previewRow?.ID]);

  const queue = data?.tab === "Content_Queue" ? data.rows : [];
  const posts = order === "oldest" ? [...queue].reverse() : queue;
  const counts = Object.fromEntries(POST_FILTERS.map((f) => [f.value, f.value === "all" ? posts.length : posts.filter((r) => (r.Status || "Draft") === f.value).length]));
  const visiblePosts = filter === "all" ? posts : posts.filter((r) => (r.Status || "Draft") === filter);
  const pagedPosts = visiblePosts.slice((postPage - 1) * 10, postPage * 10);

  useEffect(() => {
    setPostPage(1);
  }, [tab, filter, order]);

  return (
    <div className="page container">
      <div className="admin-header">
        <div>
          <h1>Instagram</h1>
          <p className="stat-note">
            Live from the BeyondTheOffer Feed sheet. Approved posts go out at {data?.slots || "09:00, 13:00, 19:00"} IST, or at the time you set.
          </p>
        </div>
        <div className="feed-row">
          {tab === "Comments_Log" && (
            <button className="btn btn-secondary" onClick={onSyncComments} disabled={loading || busy}>
              Sync Instagram replies
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => load(tab)} disabled={loading}>
            <HiRefresh aria-hidden /> Refresh
          </button>
        </div>
      </div>

      {run && (
        <div className={`feed-run feed-run-${run.conclusion || run.status}`} role="status">
          <span>
            {run.status === "completed"
              ? run.conclusion === "success"
                ? `${run.id} is ${run.platform === "youtube" ? "uploaded to" : "live on"} ${PLATFORMS[run.platform].name}.`
                : `Publishing ${run.id} to ${PLATFORMS[run.platform].name} failed.`
              : `Publishing ${run.id} to ${PLATFORMS[run.platform].name}… (about 2 minutes).`}
          </span>
          {run.url && <a href={run.url} target="_blank" rel="noopener noreferrer" className="link-button">See the run</a>}
          {run.status === "completed" && <button className="link-button" onClick={() => setRun(null)}>Dismiss</button>}
        </div>
      )}

      <div className="chips" role="group" aria-label="Sheet tab">
        {Object.keys(TAB_LABELS).map((t) => (
          <button key={t} className="chip" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <label className="sort">
        <span>Sort</span>
        <select value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>

      {loading ? (
        <Loader />
      ) : error ? (
        <div className="empty-state">
          <h3>{error}</h3>
          <button className="btn btn-secondary" onClick={() => load(tab)}>Try again</button>
        </div>
      ) : tab === "Content_Queue" ? (
        <>
          <div className="seg" role="group" aria-label="Post status">
            {POST_FILTERS.map((f) => (
              <button key={f.value} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                {f.label}<span>{counts[f.value]}</span>
              </button>
            ))}
          </div>
          {visiblePosts.length === 0 ? (
            <div className="empty-state">
              <h3>{filter === "Draft" ? "Nothing to review" : "No posts here"}</h3>
              <p>New drafts arrive every morning around 6:30 AM.</p>
            </div>
          ) : (
            <div className="feed-grid">
              {pagedPosts.map((row) => (
                <PostCard key={`${row.ID}-${row.Status}-${row.Scheduled_Time_IST}`} row={row} slots={data.slots} onSave={onSave} onApprove={onApprove} onPublish={onPublish} onPreview={onPreview} onRegenerate={onRegenerate} building={!!building[row.ID]} busy={busy} postingTo={run?.id === row.ID && run.status !== "completed" ? run.platform : null} />
              ))}
            </div>
          )}
          <Pagination page={postPage} total={visiblePosts.length} onChange={setPostPage} />
        </>
      ) : (
        <SheetTable data={data} onSave={onSave} busy={busy} order={order} />
      )}

      {previewRow && (
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) { setPreviewRow(null); setPreviewRun(null); }
        }}>
          <section className="modal feed-preview-modal" role="dialog" aria-modal="true" aria-labelledby="generated-preview-title">
            <header className="modal-header">
              <h3 id="generated-preview-title">Generated preview</h3>
              <p className="stat-note">{previewRow.Title || previewRow.ID}</p>
            </header>
            <div className="modal-body">
              {previewRun?.status === "loading" ? (
                <p>Loading the latest preview…</p>
              ) : previewRun && previewRun.status !== "completed" ? (
                <p>Building the preview with the same pipeline used for posting (about 5 minutes)…</p>
              ) : previewRow.Preview_Link ? (
                /\.mp4(\?|$)/i.test(previewRow.Preview_Link.split(/\s+/)[0]) ? (
                  <video key={previewRow.Preview_Link} className="feed-preview-video" src={previewRow.Preview_Link.split(/\s+/)[0]} controls playsInline />
                ) : (
                  <div className="feed-preview-images">
                    {previewRow.Preview_Link.split(/\r?\n/).filter(Boolean).map((src) => <img key={src} src={src} alt="" />)}
                  </div>
                )
              ) : <p>No generated preview yet.</p>}
            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setPreviewRow(null); setPreviewRun(null); }}>Close</button>
              {previewRow.Status === "Approved" && previewRow.Preview_Link && (
                <button className="btn btn-secondary" disabled={busy} onClick={() => { setPreviewRow(null); setPreviewRun(null); onRegenerate(previewRow); }}>
                  Regenerate preview
                </button>
              )}
              {previewRow.Status === "Approved" && (
                <button className="btn btn-primary" disabled={busy || !!run || !previewRow.Preview_Link || (previewRun && previewRun.status !== "completed")} onClick={() => { setPreviewRow(null); onPublish(previewRow, "instagram"); }}>
                  Publish to Instagram
                </button>
              )}
              {previewRow.Status === "Approved" && canPublishToYouTube(previewRow) && (
                <button className="btn btn-primary" disabled={busy || !!run || (previewRun && previewRun.status !== "completed")} onClick={() => { setPreviewRow(null); onPublish(previewRow, "youtube"); }}>
                  Publish to YouTube
                </button>
              )}
            </footer>
          </section>
        </div>
      )}

    </div>
  );
}

export default AdminFeed;
