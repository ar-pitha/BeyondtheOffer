import { useState, useEffect } from "react";
import axios from "axios";
import JobCard from "../components/JobCard";
import Loader from "../components/Loader";
import { HiSearch, HiFilter, HiChevronLeft, HiChevronRight } from "react-icons/hi";

const ITEMS_PER_PAGE = 10;

function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [eligibilityFilter, setEligibilityFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data } = await axios.get("/api/jobs");
        setJobs(data);
      } catch (error) {
        console.error("Error fetching jobs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, eligibilityFilter]);

  if (loading) return <Loader />;

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.company.toLowerCase().includes(search.toLowerCase()) ||
      job.description.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "All" || job.type === typeFilter;
    const matchesEligibility =
      eligibilityFilter === "All" || job.eligibility === eligibilityFilter;
    return matchesSearch && matchesType && matchesEligibility;
  });

  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = filteredJobs.slice(
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
        <h1>Job Openings</h1>
        <p>Explore opportunities from top platforms</p>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-search">
          <HiSearch className="filter-search-icon" />
          <input
            type="text"
            className="form-control"
            placeholder="Search by title, company or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-controls">
          <div className="filter-group">
            <HiFilter style={{ color: "var(--text-muted)", fontSize: "1rem", flexShrink: 0 }} />
            <select
              className="form-control"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="All">Type</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Internship">Internship</option>
              <option value="Contract">Contract</option>
              <option value="Remote">Remote</option>
            </select>
          </div>
          <div className="filter-group">
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

      {/* Results info — only show when filtering or paginating */}
      {(search || typeFilter !== "All" || eligibilityFilter !== "All" || totalPages > 1) && filteredJobs.length > 0 && (
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
          Showing <strong style={{ color: "var(--text-primary)" }}>{paginatedJobs.length}</strong> of{" "}
          <strong style={{ color: "var(--text-primary)" }}>{filteredJobs.length}</strong> jobs
        </p>
      )}

      {filteredJobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h3>No jobs found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <div className="grid">
            {paginatedJobs.map((job) => (
              <JobCard key={job._id} job={job} />
            ))}
          </div>

          {/* Pagination */}
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

export default Jobs;
