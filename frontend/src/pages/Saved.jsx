import { Link } from "react-router-dom";
import OppRow from "../components/OppRow";
import useOpps from "../hooks/useOpps";
import useSaved from "../hooks/useSaved";
import usePageMeta from "../hooks/usePageMeta";
import { daysUntil } from "../utils/deadline";

function Saved() {
  usePageMeta("Saved", "Openings you bookmarked, closest deadline first.");
  const { items, loading } = useOpps();
  const { saved } = useSaved();

  const rank = (o) => {
    const n = daysUntil(o.deadline);
    return n === null ? 10_000 : n < 0 ? 20_000 : n;
  };
  const list = items.filter((o) => saved.includes(o.id)).sort((a, b) => rank(a) - rank(b));

  return (
    <>
      <header className="screen-head">
        <h1>Saved</h1>
        {!loading && list.length > 0 && <span className="count">{list.length}</span>}
      </header>

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
