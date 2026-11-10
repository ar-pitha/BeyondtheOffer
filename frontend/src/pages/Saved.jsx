import { useState } from "react";
import { Link } from "react-router-dom";
import OppRow from "../components/OppRow";
import useOpps from "../hooks/useOpps";
import useSaved from "../hooks/useSaved";
import usePageMeta from "../hooks/usePageMeta";
import { SORTS, sortItems } from "../utils/sort";

function Saved() {
  usePageMeta("Saved", "Openings you bookmarked, newest first.");
  const { items, loading } = useOpps();
  const { saved } = useSaved();
  const [sort, setSort] = useState("newest");

  const list = sortItems(items.filter((o) => saved.includes(o.id)), sort);

  return (
    <>
      <header className="screen-head">
        <h1>Saved</h1>
        {!loading && list.length > 0 && <span className="count">{list.length}</span>}
      </header>

      {list.length > 1 && (
        <label className="sort">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      )}

      {loading ? (
        <p className="note">Loading…</p>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>Tap the bookmark on any opening to keep it here.</p>
          <Link to="/" className="text-link">Go to feed</Link>
        </div>
      ) : (
        <ul className="rows">
          {list.map((o) => <OppRow key={o.id} opp={o} />)}
        </ul>
      )}
    </>
  );
}

export default Saved;
