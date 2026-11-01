import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { FaInstagram } from "react-icons/fa";
import DeadlineStub from "../components/DeadlineStub";
import usePageMeta from "../hooks/usePageMeta";
import { daysUntil } from "../utils/deadline";

const BOARD_SIZE = 6;

// Open items with a deadline, soonest first. Prefers this week; falls back to what's next.
function closingSoon(jobs, quizzes) {
  const items = [
    ...jobs.map((j) => ({ id: j._id, title: j.title, sub: j.company, deadline: j.deadline, to: "/jobs" })),
    ...quizzes.map((q) => ({ id: q._id, title: q.title, sub: q.organiser || q.platform || "Hackathon", deadline: q.deadline, to: "/quizzes" })),
  ]
    .map((item) => ({ ...item, days: daysUntil(item.deadline) }))
    .filter((item) => item.days !== null && item.days >= 0)
    .sort((a, b) => a.days - b.days);

  const thisWeek = items.filter((item) => item.days <= 7);
  return { items: (thisWeek.length ? thisWeek : items).slice(0, BOARD_SIZE), isThisWeek: thisWeek.length > 0 };
}

function Home() {
  usePageMeta(
    null,
    "Tech jobs, government notifications and hackathons for freshers in India, checked every morning and sorted by deadline."
  );

  const [userCount, setUserCount] = useState(0);
  const [board, setBoard] = useState({ items: [], isThisWeek: true, loading: true });

  useEffect(() => {
    axios
      .get("/api/auth/users/count")
      .then(({ data }) => setUserCount(data.count))
      .catch(() => {});

    Promise.all([axios.get("/api/jobs"), axios.get("/api/quizzes")])
      .then(([jobs, quizzes]) => setBoard({ ...closingSoon(jobs.data, quizzes.data), loading: false }))
      .catch(() => setBoard({ items: [], isThisWeek: true, loading: false }));
  }, []);

  return (
    <>
      <section className="hero container">
        <div>
          <h1>Find it early. Apply before it closes.</h1>
          <p className="hero-lede">
            Tech jobs, government notifications and hackathons for freshers, checked every morning and
            sorted by deadline. Every listing links to the official place to apply.
          </p>
          <div className="hero-buttons">
            <Link to="/jobs" className="btn btn-primary">Browse jobs</Link>
            <Link to="/quizzes" className="btn btn-secondary">See hackathons</Link>
          </div>
          {userCount > 0 && (
            <p className="hero-proof">
              <strong>{userCount.toLocaleString("en-IN")}</strong> students already use it to track deadlines.
            </p>
          )}
        </div>

        <aside className="board" aria-labelledby="board-title">
          <div className="board-head">
            <h2 id="board-title">{board.isThisWeek || board.items.length === 0 ? "Closing this week" : "Closing next"}</h2>
            <Link to="/jobs">See all</Link>
          </div>
          {board.loading ? (
            <div className="board-empty">Loading deadlines…</div>
          ) : board.items.length === 0 ? (
            <div className="board-empty">
              <strong>Nothing closing right now</strong>
              New openings land every morning.
            </div>
          ) : (
            <ul className="board-list">
              {board.items.map((item) => (
                <li key={item.id}>
                  <Link to={item.to} className="mini-ticket">
                    <div className="mini-ticket-main">
                      <strong>{item.title}</strong>
                      <span>{item.sub}</span>
                    </div>
                    <DeadlineStub deadline={item.deadline} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>

      <section className="steps container" aria-labelledby="steps-title">
        <h2 id="steps-title">How a listing gets here</h2>
        <ol>
          <li>
            <h3>Collected every morning</h3>
            <p>Careers pages, government notifications and hackathon sites are checked daily before 7 AM.</p>
          </li>
          <li>
            <h3>Checked against the source</h3>
            <p>Only listings from an official page, or confirmed in two places, make it to the site.</p>
          </li>
          <li>
            <h3>Sorted by deadline</h3>
            <p>The stub on each listing shows how many days you have left. Closed ones disappear on their own.</p>
          </li>
        </ol>
      </section>

      <section className="container">
        <div className="insta-band">
          <div>
            <h2>Get the list on Instagram</h2>
            <p>New posts at 9 AM, 1 PM and 7 PM. Comment JOB on any post and we'll DM you the apply links.</p>
          </div>
          <a className="btn" href="https://www.instagram.com/beyond_the.offer" target="_blank" rel="noopener noreferrer">
            <FaInstagram aria-hidden /> Follow @beyond_the.offer
          </a>
        </div>
      </section>
    </>
  );
}

export default Home;
