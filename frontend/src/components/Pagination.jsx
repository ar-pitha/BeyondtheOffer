import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

function pageNumbers(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "...", total];
  if (current >= total - 2) return [1, "...", total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const go = (p) => {
    onChange(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <nav className="pagination" aria-label="Pages">
      <button className="pagination-btn" onClick={() => go(page - 1)} disabled={page === 1} aria-label="Previous page">
        <HiChevronLeft />
      </button>
      {pageNumbers(page, totalPages).map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="pagination-dots">…</span>
        ) : (
          <button
            key={p}
            className={`pagination-btn ${page === p ? "active" : ""}`}
            onClick={() => go(p)}
            aria-current={page === p ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}
      <button className="pagination-btn" onClick={() => go(page + 1)} disabled={page === totalPages} aria-label="Next page">
        <HiChevronRight />
      </button>
    </nav>
  );
}

export default Pagination;
