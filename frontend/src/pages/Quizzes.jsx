import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import QuizCard, { EVENT_LABELS } from "../components/QuizCard";
import Loader from "../components/Loader";
import Pagination from "../components/Pagination";
import usePageMeta from "../hooks/usePageMeta";
import { daysUntil } from "../utils/deadline";
import { HiSearch } from "react-icons/hi";

const ITEMS_PER_PAGE = 10;

function Quizzes() {
  usePageMeta(
    "Hackathons, quizzes and contests",
    "Hackathons, quizzes, CTFs and coding contests for students, sorted by registration deadline."
  );

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [hideClosed, setHideClosed] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    axios
      .get("/api/quizzes")
      .then(({ data }) => setQuizzes(data))
      .catch(() => setError("Events didn't load. Check your connection and refresh the page."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => setPage(1), [search, eventType, eligibility, hideClosed]);

  // Only offer chips for event types that exist
  const types = useMemo(
    () => Object.keys(EVENT_LABELS).filter((t) => quizzes.some((q) => q.eventType === t)),
    [quizzes]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quizzes
      .filter((quiz) => {
        if (q && ![quiz.title, quiz.description, quiz.platform, quiz.organiser].some((f) => f?.toLowerCase().includes(q))) return false;
        if (eventType && quiz.eventType !== eventType) return false;
        if (eligibility && quiz.eligibility !== eligibility) return false;
        if (hideClosed && (daysUntil(quiz.deadline) ?? 0) < 0) return false;
        return true;
      })
      .sort((a, b) => {
        // Soonest deadline first; items without a deadline after them
        const da = daysUntil(a.deadline);
        const db = daysUntil(b.deadline);
        if (da === null && db === null) return new Date(b.createdAt) - new Date(a.createdAt);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
  }, [quizzes, search, eventType, eligibility, hideClosed]);

  if (loading) return <Loader />;

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const visible = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="page container">
      <header className="page-header">
        <h1>Hackathons, quizzes and contests</h1>
        <p>Sorted by registration deadline, so the ones closing first are on top.</p>
      </header>

      {types.length > 0 && (
        <div className="chips" role="group" aria-label="Event type">
          <button className="chip" aria-pressed={eventType === ""} onClick={() => setEventType("")}>
            All
          </button>
          {types.map((t) => (
            <button key={t} className="chip" aria-pressed={eventType === t} onClick={() => setEventType(t)}>
              {EVENT_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      <div className="filters-bar">
        <label className="filter-search">
          <span className="sr-only">Search events</span>
          <HiSearch className="filter-search-icon" aria-hidden />
          <input
            type="search"
            className="form-control"
            placeholder="Search name, organiser or platform"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="filter-controls">
          <label className="filter-group">
            <span className="sr-only">Who can join</span>
            <select className="form-control" value={eligibility} onChange={(e) => setEligibility(e.target.value)}>
              <option value="">Anyone</option>
              <option value="Freshers">Freshers</option>
              <option value="Experienced">Experienced</option>
              <option value="Freshers & Experienced">Freshers & Experienced</option>
            </select>
          </label>
          <label className="toggle-check">
            <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} />
            Hide closed
          </label>
        </div>
      </div>

      {error ? (
        <div className="empty-state">
          <h3>{error}</h3>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No events match these filters</h3>
          <p>New hackathons and contests are added every morning.</p>
        </div>
      ) : (
        <>
          <p className="results-line">
            <strong>{filtered.length}</strong> {filtered.length === 1 ? "event" : "events"}
          </p>
          <div className="grid">
            {visible.map((quiz) => (
              <QuizCard key={quiz._id} quiz={quiz} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default Quizzes;
