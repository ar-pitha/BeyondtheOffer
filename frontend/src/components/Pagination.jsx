import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

export default function Pagination({ page, total, pageSize = 10, onChange }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  return (
    <div className="admin-pagination" aria-label="Pagination">
      <span>
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="admin-pagination-actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
        >
          <HiChevronLeft aria-hidden /> Previous
        </button>
        <span aria-live="polite">Page {page} of {pages}</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onChange(page + 1)}
          disabled={page === pages}
        >
          Next <HiChevronRight aria-hidden />
        </button>
      </div>
    </div>
  );
}
