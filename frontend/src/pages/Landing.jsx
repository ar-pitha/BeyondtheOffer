import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import OppRow from "../components/OppRow";
import useOpps from "../hooks/useOpps";
import usePageMeta from "../hooks/usePageMeta";
import { daysUntil } from "../utils/deadline";

// For visitors: what this is, the next few deadlines, and one way in.
function Landing() {
  usePageMeta(null, "Jobs, government exams and hackathons for freshers in India. Checked every morning, sorted by deadline.");
  const { items, loading } = useOpps();
  const [students, setStudents] = useState(0);

  useEffect(() => {
    axios.get("/api/auth/users/count").then(({ data }) => setStudents(data.count)).catch(() => {});
  }, []);

  const next = items
    .filter((o) => {
      const n = daysUntil(o.deadline);
      return n !== null && n >= 0;
    })
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
    .slice(0, 5);

  return (
    <div className="landing">
      <section className="hero">
        <h1>Jobs, govt exams and hackathons for freshers.</h1>
        <p>Checked every morning. Sorted by deadline. Official links only.</p>
        <div className="hero-actions">
          <Link to="/register" className="btn btn-dark">Sign up free</Link>
          <Link to="/login" className="text-link">I have an account</Link>
        </div>
        {students > 0 && <p className="note">{students.toLocaleString("en-IN")} students use it.</p>}
      </section>

      <section>
        <h2 className="label">Closing next</h2>
        {loading ? (
          <p className="note">Loading…</p>
        ) : next.length === 0 ? (
          <p className="note">New openings land every morning.</p>
        ) : (
          <ul className="rows">
            {next.map((o) => <OppRow key={o.id} opp={o} canSave={false} />)}
          </ul>
        )}
        <Link to="/register" className="more">See all openings</Link>
      </section>
    </div>
  );
}

export default Landing;
