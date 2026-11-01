import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import JobCard from "../components/JobCard";
import Loader from "../components/Loader";
import Pagination from "../components/Pagination";
import usePageMeta from "../hooks/usePageMeta";
import { daysUntil } from "../utils/deadline";
import { HiSearch } from "react-icons/hi";

const ITEMS_PER_PAGE = 10;
const KINDS = [
  { value: "all", label: "All" },
  { value: "tech", label: "Tech" },
  { value: "govt", label: "Govt" },
];

const batchesOf = (job) => (job.batch || "").match(/20\d\d/g) || [];
const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

function Jobs() {
  usePageMeta(
    "Jobs and internships",
    "Tech jobs, internships and government notifications for freshers, each with its deadline and an official apply link."
  );

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [sector, setSector] = useState("");
  const [location, setLocation] = useState("");
  const [batch, setBatch] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    axios
      .get("/api/jobs")
      .then(({ data }) => setJobs(data))
      .catch(() => setError("Jobs didn't load. Check your connection and refresh the page."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => setPage(1), [kind, search, type, sector, location, batch, sort]);

  const kindCounts = useMemo(
    () => ({
      all: jobs.length,
      tech: jobs.filter((j) => j.jobKind === "tech").length,
      govt: jobs.filter((j) => j.jobKind === "govt").length,
    }),
    [jobs]
  );

  // Filter options come from the jobs in the current tab
  const inKind = useMemo(() => jobs.filter((j) => kind === "all" || j.jobKind === kind), [jobs, kind]);
  const options = useMemo(
    () => ({
      sectors: uniqueSorted(inKind.map((j) => j.sector)),
      locations: uniqueSorted(inKind.map((j) => j.location?.trim())),
      batches: uniqueSorted(inKind.flatMap(batchesOf)),
    }),
    [inKind]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = inKind.filter((job) => {
      if (q && ![job.title, job.company, job.description, job.sector].some((f) => f?.toLowerCase().includes(q))) return false;
      if (type && job.type !== type) return false;
      if (sector && job.sector !== sector) return false;
      if (location && job.location?.trim() !== location) return false;
      if (batch && !batchesOf(job).includes(batch)) return false;
      return true;
    });
    if (sort === "closing") {
      // Open deadlines first (soonest on top), then no deadline, then closed
      const rank = (j) => {
        const d = daysUntil(j.deadline);
        return d === null ? 10_000 : d < 0 ? 20_000 - d : d;
      };
      return [...list].sort((a, b) => rank(a) - rank(b));
    }
    return list;
  }, [inKind, search, type, sector, location, batch, sort]);

  if (loading) return <Loader />;

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const visible = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const hasFilters = search || type || sector || location || batch;
  const clearFilters = () => {
    setSearch("");
    setType("");
    setSector("");
    setLocation("");
    setBatch("");
  };

  return (
    <div className="page container">
      <header className="page-header">
        <h1>Jobs and internships</h1>
        <p>Tech roles and government notifications, each linked to the official place to apply.</p>
      </header>

      <div className="seg" role="group" aria-label="Job category">
        {KINDS.map((k) => (
          <button key={k.value} aria-pressed={kind === k.value} onClick={() => setKind(k.value)}>
            {k.label}
            <span>{kindCounts[k.value]}</span>
          </button>
        ))}
      </div>

      <div className="filters-bar">
        <label className="filter-search">
          <span className="sr-only">Search jobs</span>
          <HiSearch className="filter-search-icon" aria-hidden />
          <input
            type="search"
            className="form-control"
            placeholder="Search role, company or skill"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="filter-controls">
          <label className="filter-group">
            <span className="sr-only">Job type</span>
            <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Any type</option>
              {["Full-time", "Internship", "Part-time", "Contract", "Remote"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          {options.sectors.length > 0 && (
            <label className="filter-group">
              <span className="sr-only">Sector</span>
              <select className="form-control" value={sector} onChange={(e) => setSector(e.target.value)}>
                <option value="">Any sector</option>
                {options.sectors.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <label className="filter-group">
            <span className="sr-only">Location</span>
            <select className="form-control" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">Any location</option>
              {options.locations.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          {options.batches.length > 0 && (
            <label className="filter-group">
              <span className="sr-only">Batch</span>
              <select className="form-control" value={batch} onChange={(e) => setBatch(e.target.value)}>
                <option value="">Any batch</option>
                {options.batches.map((b) => (
                  <option key={b} value={b}>Batch {b}</option>
                ))}
              </select>
            </label>
          )}
          <label className="filter-group">
            <span className="sr-only">Sort</span>
            <select className="form-control" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="closing">Closing soonest</option>
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="empty-state">
          <h3>{error}</h3>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No jobs match these filters</h3>
          <p>New openings are added every morning.</p>
          {hasFilters && (
            <button className="btn btn-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="results-line">
            <strong>{filtered.length}</strong> {filtered.length === 1 ? "opening" : "openings"}
            {hasFilters && (
              <>
                {" "}
                <button className="link-button" onClick={clearFilters}>Clear filters</button>
              </>
            )}
          </p>
          <div className="grid">
            {visible.map((job) => (
              <JobCard key={job._id} job={job} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default Jobs;
