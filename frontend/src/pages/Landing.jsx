import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import OppRow from "../components/OppRow";
import useOpps from "../hooks/useOpps";
import usePageMeta from "../hooks/usePageMeta";
import { daysUntil } from "../utils/deadline";
import { trackSiteView } from "../utils/siteViews";

const SKELETON_ROWS = 4;

// 0 → "000", 9 → "009"; real counts above 999 keep their separators.
const formatCount = (n) => (n < 1000 ? String(n).padStart(3, "0") : n.toLocaleString("en-IN"));

// Counts up once the real number arrives, so the figure feels alive.
function useCountUp(target, duration = 1100) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

// Counts up when it scrolls into view, so the figures are seen moving.
function SiteProof({ students }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const shownStudents = useCountUp(visible ? students : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="landing-proof"
      aria-label={`${students} students`}
    >
      <div className="proof-item">
        <span className="proof-number" aria-hidden="true">{formatCount(shownStudents)}</span>
        <span className="proof-label">already using BeyondTheOffer</span>
      </div>
    </section>
  );
}

// Same footprint as OppRow, so the list doesn't jump when the data arrives.
function SkeletonRow() {
  return (
    <li className="row skeleton-row" aria-hidden="true">
      <div className="row-body">
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-org" />
        <span className="skeleton skeleton-meta" />
        <span className="skeleton skeleton-action" />
      </div>
      <span className="skeleton skeleton-stub" />
    </li>
  );
}

// For visitors: what this is, the next few deadlines, and one way in.
function Landing() {
  usePageMeta(
    null,
    "Verified tech jobs, government notifications and hackathons for students in India. Updated every morning and sorted by deadline."
  );
  const { items, loading } = useOpps();
  const [students, setStudents] = useState(0);

  useEffect(() => {
    let alive = true;

    axios
      .get("/api/auth/users/count")
      .then(({ data }) => {
        if (alive) setStudents(data.count);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  const next = useMemo(
    () =>
      items
        .filter((o) => {
          const n = daysUntil(o.deadline);
          return n !== null && n >= 0;
        })
        .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
        .slice(0, 5),
    [items]
  );

  return (
    <div className="landing">
      <section className="hero">
        <h1>Less scrolling. More opportunities.</h1>
        <p>
          Verified jobs, government notifications and hackathons for students in India — updated
          every morning and ordered by what closes first.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="btn btn-dark">Create free account</Link>
          <Link to="/login" className="text-link">Log in</Link>
        </div>
        <p className="hero-trust">Free for students · No spam · Only official links</p>
      </section>

      <section className="landing-jobs" aria-busy={loading}>
        <h2 className="label">Closing next</h2>
        {loading ? (
          <>
            <span className="sr-only" role="status">Loading the latest openings…</span>
            <ul className="rows">
              {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </ul>
          </>
        ) : next.length === 0 ? (
          <p className="note">New openings land every morning.</p>
        ) : (
          <ul className="rows">
            {next.map((o) => <OppRow key={o.id} opp={o} canSave={false} />)}
          </ul>
        )}
        <Link to="/register" className="more">See all openings</Link>
      </section>

      <SiteProof students={students} />
    </div>
  );
}

export default Landing;
