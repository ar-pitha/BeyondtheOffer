import { useState, useEffect } from "react";
import axios from "axios";
import QuizCard from "../components/QuizCard";
import Loader from "../components/Loader";
import { HiSearch, HiFilter, HiChevronLeft, HiChevronRight } from "react-icons/hi";

const ITEMS_PER_PAGE = 10;

function Quizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const { data } = await axios.get("/api/quizzes");
        setQuizzes(data);
      } catch (error) {
        console.error("Error fetching quizzes:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, eligibilityFilter]);

  if (loading) return <Loader />;

  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesSearch =
      quiz.title.toLowerCase().includes(search.toLowerCase()) ||
      quiz.description.toLowerCase().includes(search.toLowerCase()) ||
      (quiz.platform && quiz.platform.toLowerCase().includes(search.toLowerCase()));
    const matchesEligibility =
      eligibilityFilter === "All" || quiz.eligibility === eligibilityFilter;
    return matchesSearch && matchesEligibility;
  });

  const totalPages = Math.ceil(filteredQuizzes.length / ITEMS_PER_PAGE);
  const paginatedQuizzes = filteredQuizzes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="page container">
      <div className="page-header">
        <h1>Quizzes & Challenges</h1>
        <p>Join live quizzes and competitions from top platforms</p>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-search">
          <HiSearch className="filter-search-icon" />
          <input
            type="text"
            className="form-control"
            placeholder="Search by title, platform or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-controls">
          <div className="filter-group">
            <HiFilter style={{ color: "var(--text-muted)", fontSize: "1rem", flexShrink: 0 }} />
            <select
              className="form-control"
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
            >
              <option value="All">Eligibility</option>
              <option value="Freshers">Freshers</option>
              <option value="Experienced">Experienced</option>
              <option value="Freshers & Experienced">Freshers & Experienced</option>
            </select>
          </div>
        </div>
      </div>

      {(search || eligibilityFilter !== "All" || totalPages > 1) && filteredQuizzes.length > 0 && (
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
          Showing <strong style={{ color: "var(--text-primary)" }}>{paginatedQuizzes.length}</strong> of{" "}
          <strong style={{ color: "var(--text-primary)" }}>{filteredQuizzes.length}</strong> quizzes
        </p>
      )}

      {filteredQuizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧩</div>
          <h3>No quizzes found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <div className="grid">
            {paginatedQuizzes.map((quiz) => (
              <QuizCard key={quiz._id} quiz={quiz} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <HiChevronLeft />
              </button>

              {getPageNumbers().map((page, i) =>
                page === "..." ? (
                  <span key={`dots-${i}`} className="pagination-dots">…</span>
                ) : (
                  <button
                    key={page}
                    className={`pagination-btn ${currentPage === page ? "active" : ""}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <HiChevronRight />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Quizzes;
