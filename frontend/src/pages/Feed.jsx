import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { HiSearch } from "react-icons/hi";
import OppRow from "../components/OppRow";
import useOpps from "../hooks/useOpps";
import usePageMeta from "../hooks/usePageMeta";
import { daysUntil } from "../utils/deadline";
import { SORTS, isSort, sortItems } from "../utils/sort";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "tech", label: "Tech" },
  { value: "govt", label: "Govt" },
  { value: "events", label: "Events" },
];
const PAGE = 25;

function Feed() {
  usePageMeta("Feed", "Jobs, government exams and hackathons for freshers, newest first.");
  const { items, loading, error } = useOpps();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.some((f) => f.value === params.get("kind")) ? params.get("kind") : "all";
  const sort = isSort(params.get("sort")) ? params.get("sort") : "newest";
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Closed ones are hidden
    const open = items
      .filter((o) => (daysUntil(o.deadline) ?? 0) >= 0)
      .filter((o) => filter === "all" || (filter === "events" ? o.kind === "event" : o.kind === filter))
      .filter((o) => !q || [o.title, o.org, o.meta].some((f) => f?.toLowerCase().includes(q)));
    return sortItems(open, sort);
  }, [items, filter, sort, query]);

  // Both live in the URL so a shared link opens the same view
  const setView = (kind, order) => {
    setShown(PAGE);
    const next = {};
    if (kind !== "all") next.kind = kind;
    if (order !== "newest") next.sort = order;
    setParams(next, { replace: true });
  };
  const setFilter = (value) => setView(value, sort);

  return (
    <div className="feed-layout">
      {/* Desktop: this column sits on the left and stays in view */}
      <aside className="feed-side">
      <header className="screen-head">
        <h1>Openings</h1>
        {!loading && <span className="count">{list.length}</span>}
      </header>

      <label className="search">
        <HiSearch aria-hidden />
        <span className="sr-only">Search</span>
        <input type="search" placeholder="Search role or company" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} />
      </label>

      <div className="chips" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f.value} className="chip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      <label className="sort">
        <span>Sort</span>
        <select value={sort} onChange={(e) => setView(filter, e.target.value)}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      </aside>

      <section className="feed-list">
      {loading ? (
        <p className="note">Loading openings…</p>
      ) : error ? (
        <p className="note">{error}</p>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>No openings match.</p>
          {(query || filter !== "all") && (
            <button className="text-link" onClick={() => { setQuery(""); setFilter("all"); }}>Clear search</button>
          )}
        </div>
      ) : (
        <>
          <ul className="rows">
            {list.slice(0, shown).map((o) => <OppRow key={o.id} opp={o} />)}
          </ul>
          {shown < list.length && (
            <button className="more" onClick={() => setShown((n) => n + PAGE)}>
              Show more ({list.length - shown})
            </button>
          )}
        </>
      )}
      </section>
    </div>
  );
}

export default Feed;
