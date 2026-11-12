import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { HiExternalLink, HiRefresh, HiSearch } from "react-icons/hi";
import Loader from "../components/Loader";
import usePageMeta from "../hooks/usePageMeta";

// The admin sheet API is a Vercel function on this site, not the backend API
const api = { baseURL: "" };

// The flow, left to right: pick openings → a post waits with its preview → publish.
// Rejected openings and ones that closed on their own each have their own list.
const TABS = [
  { key: "openings", label: "Openings" },
  { key: "posts", label: "Posts" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
  { key: "expired", label: "Expired" },
];
const ORDER = ["tech", "govt", "events", "news"];
const KIND_CLASS = { tech: "kind-tech", govt: "kind-govt", events: "kind-event", news: "kind-news" };
// How many fit in one post: news cards are short, so news takes more (same as _lib/carousel.js)
const maxPick = (kind) => (kind === "news" ? 6 : 4);

// Openings filters. News has no closing date, so a "closes within" window leaves it out.
const WINDOWS = [
  { value: "any", label: "Any time", test: () => true },
  { value: "3", label: "Within 3 days", test: (o) => o.daysLeft !== null && o.daysLeft <= 3 },
  { value: "7", label: "Within 7 days", test: (o) => o.daysLeft !== null && o.daysLeft <= 7 },
  { value: "30", label: "Within 30 days", test: (o) => o.daysLeft !== null && o.daysLeft <= 30 },
  { value: "none", label: "No closing date", test: (o) => o.daysLeft === null && o.category !== "news" },
];
const byAdded = (o) => o.addedAt || 0;
const SORTS = [
  // The API sends each kind most urgent first (news newest first); a stable sort keeps that
  { value: "urgent", label: "Most urgent", compare: () => 0 },
  { value: "newest", label: "Newest added", compare: (a, b) => byAdded(b) - byAdded(a) },
  { value: "oldest", label: "Oldest added", compare: (a, b) => byAdded(a) - byAdded(b) },
];
// The last sort and window this browser used
const remembered = (key, options) => () => {
  try {
    const v = localStorage.getItem(key);
    return options.some((o) => o.value === v) ? v : options[0].value;
  } catch {
    return options[0].value;
  }
};
const BUILD_MINUTES = 20; // stop waiting for a preview after this long

const slides = (post) =>
  String(post.Preview_Link || "")
    .split(/\s+/)
    .filter((u) => /^https?:\/\//.test(u) && !/\.mp4(\?|$)/i.test(u));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Days left (jobs, hackathons) or age (news)
function When({ o }) {
  if (o.age !== undefined) {
    return <span className="op-when">{o.age === null ? "" : o.age === 0 ? "Today" : `${o.age}d ago`}</span>;
  }
  if (o.closed) return <span className="op-when is-urgent">Closed{o.closes && <small>{o.closes}</small>}</span>;
  const d = o.daysLeft;
  return (
    <span className={`op-when${d !== null && d <= 2 ? " is-urgent" : d !== null && d <= 7 ? " is-soon" : ""}`}>
      {d === null ? "No date" : d === 0 ? "Closes today" : `${plural(d, "day")} left`}
      {o.closes && <small>{o.closes}</small>}
    </span>
  );
}

function Kind({ category, labels }) {
  return <span className={`kind ${KIND_CLASS[category] || ""}`}>{labels[category] || "Post"}</span>;
}

function Empty({ title, children }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

// ── Openings: tick up to 4 of one kind, then create the post ─────────────────
function OpeningsTab({ board, creating, onCreate, onReject }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(remembered("bto-board-sort", SORTS));
  const [within, setWithin] = useState(remembered("bto-board-within", WINDOWS));
  const choose = (key, set) => (e) => {
    set(e.target.value);
    try {
      localStorage.setItem(key, e.target.value);
    } catch {
      /* storage blocked: the choice just isn't remembered */
    }
  };
  const [picked, setPicked] = useState([]);
  const byId = useMemo(() => new Map(board.openings.map((o) => [o.id, o])), [board.openings]);

  // A pick that left the list (rejected, grouped, closed) drops out of the selection
  useEffect(() => {
    setPicked((p) => (p.every((id) => byId.has(id)) ? p : p.filter((id) => byId.has(id))));
  }, [byId]);

  const kind = picked.length ? byId.get(picked[0])?.category : null;
  const q = query.trim().toLowerCase();
  const inWindow = WINDOWS.find((w) => w.value === within).test;
  const visible = board.openings
    .filter((o) => (filter === "all" || o.category === filter) && inWindow(o) && (!q || `${o.name} ${o.detail} ${o.id}`.toLowerCase().includes(q)))
    .sort(SORTS.find((s) => s.value === sort).compare);
  const count = (c) => board.openings.filter((o) => o.category === c).length;
  const sections = (filter === "all" ? ORDER : [filter])
    .map((c) => [c, visible.filter((o) => o.category === c)])
    .filter(([, list]) => list.length);

  const lockReason = (o) => {
    if (picked.includes(o.id)) return "";
    if (kind && o.category !== kind) return `A post holds one kind. You're picking ${board.categories[kind].toLowerCase()}.`;
    if (kind && picked.length >= maxPick(kind)) return `A post holds up to ${maxPick(kind)}.`;
    return "";
  };
  const toggle = (o) =>
    setPicked((p) => (p.includes(o.id) ? p.filter((id) => id !== o.id) : lockReason(o) ? p : [...p, o.id]));
  const done = (ok) => ok && setPicked([]);

  return (
    <>
      <div className="board-tools">
        <div className="seg" role="group" aria-label="Kind of opening">
          <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            All<span>{board.openings.length}</span>
          </button>
          {ORDER.map((c) => (
            <button key={c} aria-pressed={filter === c} onClick={() => setFilter(c)}>
              {board.categories[c]}<span>{count(c)}</span>
            </button>
          ))}
        </div>
        <label className="board-search">
          <HiSearch aria-hidden />
          <input type="search" placeholder="Search company, role or ID" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search openings" />
        </label>
        <div className="board-selects">
          <label className="sort">
            <span>Closes</span>
            <select value={within} onChange={choose("bto-board-within", setWithin)}>
              {WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </label>
          <label className="sort">
            <span>Sort</span>
            <select value={sort} onChange={choose("bto-board-sort", setSort)}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </div>
      <p className="stat-note board-hint">
        Tick up to 4 of one kind (6 for news) and create a post. Closed and posted openings are already gone
        {board.inPosts > 0 && `, and ${board.inPosts} are in Posts`}.
      </p>

      {sections.length === 0 ? (
        <Empty title={q || within !== "any" ? "Nothing matches" : "No openings here"}>{q || within !== "any" ? "Try another word or a wider closing window." : "New ones arrive with every sync."}</Empty>
      ) : (
        sections.map(([c, list]) => (
          <section key={c} className="op-section" aria-label={board.categories[c]}>
            {filter === "all" && (
              <h2 className="op-heading">
                <Kind category={c} labels={board.categories} /> <span>{list.length}</span>
              </h2>
            )}
            <ul className="op-list">
              {list.map((o) => {
                const on = picked.includes(o.id);
                const lock = lockReason(o);
                return (
                  <li key={o.id} className={`op-row${on ? " is-picked" : ""}${lock ? " is-locked" : ""}`}>
                    <label className="op-pick" title={lock}>
                      <input type="checkbox" checked={on} disabled={!!lock} onChange={() => toggle(o)} />
                      <span className="op-main">
                        <b>{o.name}</b>
                        {o.detail && <small className="op-detail" title={o.detail}>{o.detail}</small>}
                        <small className="op-meta">{o.id} · {o.verified}</small>
                      </span>
                      <When o={o} />
                    </label>
                    <button className="link-button op-reject" onClick={() => onReject([o.id])} aria-label={`Reject ${o.name}`}>
                      Reject
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {picked.length > 0 && (
        <div className="pick-dock" role="region" aria-label="Picked openings">
          <div className="pick-dock-text">
            <b>
              {picked.length} of {maxPick(kind)} · {board.categories[kind]}
            </b>
            <small>{picked.map((id) => byId.get(id)?.name).join(", ")}</small>
          </div>
          <div className="pick-dock-actions">
            <button className="link-button" onClick={() => setPicked([])}>Clear</button>
            <button className="btn btn-secondary btn-sm" disabled={creating} onClick={() => onReject(picked).then(done)}>
              Reject
            </button>
            <button className="btn btn-primary btn-sm" disabled={creating} onClick={() => onCreate(picked).then(done)}>
              {creating ? "Creating…" : "Create post"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Posts: waiting for their preview, then publish ───────────────────────────
function PostCard({ post, labels, building, posting, busy, onOpen, onBuild, onRebuild, onUngroup, onSaveCaption }) {
  const pics = slides(post);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(post.Caption);
  const closed = post.items.filter((i) => i.closed).length;
  const locked = busy || posting;

  return (
    <li className="post-card">
      <div className="post-top">
        <Kind category={post.category} labels={labels} />
        <span className="post-id">{post.ID}</span>
      </div>
      <h3 className="post-title">{post.Title}</h3>
      <ul className="post-items">
        {post.items.map((i) => (
          <li key={i.id} className={i.closed ? "is-closed" : ""}>
            <span>{i.name}</span>
            <When o={i} />
          </li>
        ))}
      </ul>
      {closed > 0 && (
        <p className="post-note">
          {closed === 1 ? "1 opening has" : `${closed} openings have`} closed. It's swapped for the next most urgent one within a few minutes, and the preview is rebuilt.
        </p>
      )}

      <div className="post-preview">
        {pics.length > 0 ? (
          <button className="post-thumbs" onClick={onOpen} aria-label={`Open the ${pics.length} slides`}>
            {pics.map((src) => <img key={src} src={src} alt="" loading="lazy" />)}
          </button>
        ) : building ? (
          <p className="post-building"><span className="pulse" aria-hidden /> Building the preview… about 3 minutes</p>
        ) : (
          <p className="post-building">
            No preview yet.{" "}
            <button className="link-button" disabled={locked} onClick={onBuild}>Build it now</button>
          </p>
        )}
      </div>

      <details className="post-caption" onToggle={(e) => !e.currentTarget.open && setEditing(false)}>
        <summary>Caption</summary>
        {editing ? (
          <>
            <textarea className="form-control" rows={8} value={caption} onChange={(e) => setCaption(e.target.value)} />
            <div className="post-actions">
              <button className="btn btn-primary btn-sm" disabled={locked} onClick={() => onSaveCaption(caption).then((ok) => ok && setEditing(false))}>
                Save caption
              </button>
              <button className="link-button" onClick={() => { setCaption(post.Caption); setEditing(false); }}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p className="post-caption-text">{post.Caption}</p>
            {post.Hashtags && <p className="post-tags">{post.Hashtags}</p>}
            <button className="link-button" disabled={locked} onClick={() => setEditing(true)}>Edit caption</button>
          </>
        )}
      </details>

      <div className="post-actions">
        <button className="btn btn-primary btn-sm" disabled={!pics.length || locked} onClick={onOpen}>
          {posting ? "Publishing…" : "Review and publish"}
        </button>
        {pics.length > 0 && (
          <button className="btn btn-secondary btn-sm" disabled={locked} onClick={onRebuild}>Rebuild preview</button>
        )}
        <button className="link-button post-ungroup" disabled={locked} onClick={onUngroup}>Ungroup</button>
      </div>
    </li>
  );
}

// A plain row for the Rejected and Expired lists
function ItemRow({ o, labels, action }) {
  return (
    <li className="op-row">
      <div className="op-pick">
        <span className="op-main">
          <b>{o.name}</b>
          {o.detail && <small className="op-detail" title={o.detail}>{o.detail}</small>}
          <small className="op-meta"><Kind category={o.category} labels={labels} /> · {o.id}</small>
        </span>
        <When o={o} />
      </div>
      {action}
    </li>
  );
}

function AdminFeed() {
  usePageMeta("Instagram");
  const [board, setBoard] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("openings");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState({}); // post ID → an action on it is running
  const [building, setBuilding] = useState({}); // post ID → when its preview build started
  const [run, setRun] = useState(null); // { id, status, conclusion, url } of a publish
  const [openId, setOpenId] = useState(null); // post shown in the slides dialog

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/admin-sheet", { ...api, params: { view: "board" } });
      setBoard(data);
      setError("");
      // News posts the board just grouped by itself: follow their previews like hand-made ones
      if (data.grouped?.length) {
        setBuilding((b) => ({ ...b, ...Object.fromEntries(data.grouped.map((id) => [id, Date.now()])) }));
        toast.success(`${data.grouped.length} tech news ${data.grouped.length === 1 ? "post" : "posts"} added to Posts`);
      }
      return data;
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load the board. Check your connection and try again.");
      return null;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const call = (body) => axios.post("/api/admin-sheet", body, api).then((r) => r.data);
  const fail = (err, fallback) => toast.error(err.response?.data?.message || fallback);
  const withBusy = async (id, fn) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      return await fn();
    } finally {
      setBusy(({ [id]: _done, ...rest }) => rest);
    }
  };

  const createPost = async (ids) => {
    setCreating(true);
    try {
      const { row } = await call({ action: "create-carousel", ids });
      setBuilding((b) => ({ ...b, [row.ID]: Date.now() }));
      await load();
      setTab("posts");
      toast.success("Post created. Its preview is building.");
      return true;
    } catch (err) {
      fail(err, "Couldn't create the post.");
      load();
      return false;
    } finally {
      setCreating(false);
    }
  };

  // Moves openings to Rejected (or back), at once on screen, then confirms with the sheet
  const setRejected = async (ids, reject) => {
    setBoard((b) => {
      const from = reject ? "openings" : "rejected";
      const to = reject ? "rejected" : "openings";
      const moving = b[from].filter((o) => ids.includes(o.id));
      return { ...b, [from]: b[from].filter((o) => !ids.includes(o.id)), [to]: [...moving, ...b[to]] };
    });
    const what = ids.length === 1 ? "Opening" : plural(ids.length, "opening");
    try {
      await call({ action: reject ? "reject-openings" : "restore-openings", ids });
      if (reject) {
        toast(
          (t) => (
            <span className="toast-undo">
              {what} moved to Rejected
              <button className="link-button" onClick={() => { toast.dismiss(t.id); setRejected(ids, false); }}>Undo</button>
            </span>
          ),
          { duration: 6000 }
        );
      } else {
        toast.success(`${what} back in Openings`);
      }
      load();
      return true;
    } catch (err) {
      fail(err, "Couldn't update the opening.");
      load();
      return false;
    }
  };

  const ungroup = (post) =>
    withBusy(post.ID, async () => {
      try {
        await call({ action: "ungroup", id: post.ID });
        await load();
        toast(
          (t) => (
            <span className="toast-undo">
              Ungrouped. Its openings are back in Openings.
              <button
                className="link-button"
                onClick={async () => {
                  toast.dismiss(t.id);
                  try {
                    await call({ action: "regroup", id: post.ID });
                    toast.success("Post restored");
                  } catch (err) {
                    fail(err, "Couldn't restore the post.");
                  }
                  load();
                }}
              >
                Undo
              </button>
            </span>
          ),
          { duration: 6000 }
        );
      } catch (err) {
        fail(err, "Couldn't ungroup the post.");
      }
    });

  const buildPreview = (post, again) =>
    withBusy(post.ID, async () => {
      try {
        await call({ action: again ? "regenerate-preview" : "preview-now", id: post.ID });
        setBuilding((b) => ({ ...b, [post.ID]: Date.now() }));
        if (again) setBoard((b) => ({ ...b, posts: b.posts.map((p) => (p.ID === post.ID ? { ...p, Preview_Link: "" } : p)) }));
        toast.success("Building the preview. It takes about 3 minutes.");
      } catch (err) {
        fail(err, "Couldn't start the preview.");
      }
    });

  const saveCaption = (post, Caption) =>
    withBusy(post.ID, async () => {
      try {
        await call({ tab: "Content_Queue", id: post.ID, patch: { Caption } });
        setBoard((b) => ({ ...b, posts: b.posts.map((p) => (p.ID === post.ID ? { ...p, Caption } : p)) }));
        toast.success("Caption saved");
        return true;
      } catch (err) {
        fail(err, "Couldn't save the caption.");
        return false;
      }
    });

  const publish = async (post) => {
    setOpenId(null);
    setRun({ id: post.ID, status: "starting" });
    try {
      await call({ action: "publish-now", id: post.ID });
      toast.success("Publishing started. It takes about 2 minutes.");
    } catch (err) {
      setRun(null);
      fail(err, "Couldn't start publishing.");
    }
  };

  // While previews build, check every 20 s and say when each is ready
  const waiting = (board?.posts || [])
    .filter((p) => !slides(p).length && Date.now() - (building[p.ID] || 0) < BUILD_MINUTES * 60_000)
    .map((p) => p.ID)
    .join(",");
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(async () => {
      const fresh = await load();
      fresh?.posts
        .filter((p) => waiting.split(",").includes(p.ID) && slides(p).length)
        .forEach((p) => toast.success(`Preview ready: ${p.Title}`));
    }, 20000);
    return () => clearInterval(timer);
  }, [waiting, load]);

  // Follows a publish until GitHub says it finished
  useEffect(() => {
    if (!run || run.status === "completed") return;
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const s = await call({ action: "publish-status" });
        // Ignore the previous run until GitHub registers the new one
        if (s.startedAt && new Date(s.startedAt).getTime() < started - 60_000) return;
        setRun((r) => ({ ...r, ...s }));
        if (s.status === "completed") {
          clearInterval(timer);
          await load();
          if (s.conclusion === "success") {
            toast.success("Live on Instagram");
            setTab("published");
          } else {
            toast.error("Publishing failed. Open the run for details.");
          }
        }
      } catch {
        /* keep polling */
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [run?.id, run?.status === "completed"]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes the slides dialog
  useEffect(() => {
    if (!openId) return;
    const onKey = (e) => e.key === "Escape" && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  if (!board) {
    return (
      <div className="page container">
        {error ? (
          <div className="empty-state">
            <h3>{error}</h3>
            <button className="btn btn-secondary" onClick={refresh}>Try again</button>
          </div>
        ) : (
          <Loader />
        )}
      </div>
    );
  }

  const labels = board.categories;
  const counts = {
    openings: board.openings.length,
    posts: board.posts.length,
    published: board.published.length,
    rejected: board.rejected.length,
    expired: board.expired.length,
  };
  const open = board.posts.find((p) => p.ID === openId) || board.published.find((p) => p.ID === openId);
  const posting = (id) => run?.id === id && run.status !== "completed";

  return (
    <div className="page container">
      <div className="admin-header">
        <div>
          <h1>Instagram</h1>
          <p className="stat-note">Pick openings, make a post, publish it.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={refreshing} aria-label="Refresh">
          <HiRefresh aria-hidden className={refreshing ? "spin" : ""} /> Refresh
        </button>
      </div>

      {run && (
        <div className={`feed-run feed-run-${run.conclusion || run.status}`} role="status">
          <span>
            {run.status === "completed"
              ? run.conclusion === "success"
                ? `${run.id} is live on Instagram.`
                : `Publishing ${run.id} failed.`
              : `Publishing ${run.id}… about 2 minutes.`}
          </span>
          {run.url && <a href={run.url} target="_blank" rel="noopener noreferrer" className="link-button">See the run</a>}
          {run.status === "completed" && <button className="link-button" onClick={() => setRun(null)}>Dismiss</button>}
        </div>
      )}

      <nav className="board-tabs" aria-label="Instagram board">
        {TABS.map((t) => (
          <button key={t.key} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
            <span>{counts[t.key]}</span>
          </button>
        ))}
      </nav>

      {tab === "openings" && (
        <OpeningsTab board={board} creating={creating} onCreate={createPost} onReject={(ids) => setRejected(ids, true)} />
      )}

      {tab === "posts" &&
        (board.posts.length === 0 ? (
          <Empty title="No posts waiting">Pick openings in Openings and create one.</Empty>
        ) : (
          <ul className="post-list">
            {board.posts.map((p) => (
              <PostCard
                key={`${p.ID}-${p.Item_IDs}`}
                post={p}
                labels={labels}
                building={Date.now() - (building[p.ID] || 0) < BUILD_MINUTES * 60_000}
                posting={posting(p.ID)}
                busy={!!busy[p.ID]}
                onOpen={() => setOpenId(p.ID)}
                onBuild={() => buildPreview(p, false)}
                onRebuild={() => buildPreview(p, true)}
                onUngroup={() => ungroup(p)}
                onSaveCaption={(caption) => saveCaption(p, caption)}
              />
            ))}
          </ul>
        ))}

      {tab === "published" &&
        (board.published.length === 0 ? (
          <Empty title="Nothing published yet" />
        ) : (
          <ul className="pub-list">
            {board.published.map((p) => {
              const thumb = slides(p)[0] || (/^https?:\/\//.test(p.Design_Link) ? p.Design_Link : "");
              return (
                <li key={p.ID}>
                  {thumb ? (
                    <button className="pub-thumb" onClick={() => setOpenId(p.ID)} aria-label="Open the slides">
                      <img src={thumb} alt="" loading="lazy" />
                    </button>
                  ) : (
                    <span className="pub-thumb" aria-hidden />
                  )}
                  <span className="op-main">
                    <b>{p.Title}</b>
                    <small><Kind category={p.category} labels={labels} /> · {p.Date} · {p.ID}</small>
                  </span>
                  {/^https?:\/\//.test(p.IG_Post_Link) && (
                    <a className="btn btn-secondary btn-sm" href={p.IG_Post_Link} target="_blank" rel="noopener noreferrer">
                      View <HiExternalLink aria-hidden />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "rejected" &&
        (board.rejected.length === 0 ? (
          <Empty title="Nothing rejected">Openings you reject land here. Restore one to offer it again.</Empty>
        ) : (
          <ul className="op-list">
            {board.rejected.map((o) => (
              <ItemRow
                key={o.id}
                o={o}
                labels={labels}
                action={<button className="link-button op-reject" onClick={() => setRejected([o.id], false)}>Restore</button>}
              />
            ))}
          </ul>
        ))}

      {tab === "expired" && (
        <>
          <p className="stat-note board-hint">Openings move here on their own once their last date passes (last 30 days). News never expires.</p>
          {board.expired.length === 0 ? (
            <Empty title="Nothing expired" />
          ) : (
            <ul className="op-list">
              {board.expired.map((o) => <ItemRow key={o.id} o={o} labels={labels} />)}
            </ul>
          )}
        </>
      )}

      {open && (
        <div className="modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpenId(null)}>
          <section className="modal feed-preview-modal" role="dialog" aria-modal="true" aria-labelledby="slides-title">
            <header className="modal-header">
              <h3 id="slides-title">{open.Title}</h3>
              <p className="stat-note">{plural(slides(open).length, "slide")}, in the order Instagram shows them</p>
            </header>
            <div className="modal-body">
              <div className="feed-preview-images">
                {slides(open).map((src) => <img key={src} src={src} alt="" />)}
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOpenId(null)}>Close</button>
              {open.Status !== "Published" && (
                <button className="btn btn-primary" disabled={posting(open.ID) || !!busy[open.ID]} onClick={() => publish(open)}>
                  Publish to Instagram
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
