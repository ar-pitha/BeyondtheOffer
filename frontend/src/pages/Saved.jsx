import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import JobCard from "../components/JobCard";
import QuizCard from "../components/QuizCard";
import Loader from "../components/Loader";
import useSaved from "../hooks/useSaved";
import usePageMeta from "../hooks/usePageMeta";
import { daysUntil } from "../utils/deadline";

function Saved() {
  usePageMeta("Saved", "Jobs and hackathons you bookmarked, sorted by deadline.");
  const { saved } = useSaved();
  const [all, setAll] = useState(null);

  useEffect(() => {
    Promise.all([
      axios.get("/api/jobs").then((r) => r.data.map((j) => ({ type: "job", item: j }))).catch(() => []),
      axios.get("/api/quizzes").then((r) => r.data.map((q) => ({ type: "quiz", item: q }))).catch(() => []),
    ]).then(([jobs, quizzes]) => setAll([...jobs, ...quizzes]));
  }, []);

  if (!all) return <Loader />;

  // Soonest deadline first; open-ended ones last
  const rank = (d) => {
    const n = daysUntil(d);
    return n === null ? 10_000 : n < 0 ? 20_000 : n;
  };
  const items = all.filter(({ item }) => saved.includes(item._id)).sort((a, b) => rank(a.item.deadline) - rank(b.item.deadline));
  // Saved items that have since closed or been removed from the site
  const missing = saved.length - items.length;

  return (
    <div className="page">
      <header className="page-header">
        <h1>Saved</h1>
        <p>Your bookmarks, closest deadline first. Saved on this device.</p>
      </header>

      {items.length === 0 ? (
        <div className="empty-state">
          <h3>Nothing saved yet</h3>
          <p>Tap the bookmark on any job or hackathon to keep it here.</p>
          <Link to="/jobs" className="btn btn-primary">Browse jobs</Link>
        </div>
      ) : (
        <div className="feed">
          {items.map(({ type, item }) => (type === "job" ? <JobCard key={item._id} job={item} /> : <QuizCard key={item._id} quiz={item} />))}
        </div>
      )}
      {missing > 0 && items.length > 0 && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          {missing} saved {missing === 1 ? "listing has" : "listings have"} closed and been removed.
        </p>
      )}
    </div>
  );
}

export default Saved;
