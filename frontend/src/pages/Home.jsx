import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { FaInstagram } from "react-icons/fa";
import { HiOutlineBriefcase, HiOutlineLibrary, HiOutlineLightningBolt, HiOutlineNewspaper, HiChevronRight } from "react-icons/hi";
import JobCard from "../components/JobCard";
import usePageMeta from "../hooks/usePageMeta";
import { daysUntil, pillFor } from "../utils/deadline";

const isToday = (d) => d && new Date(d).toDateString() === new Date().toDateString();

function Home({ user }) {
  usePageMeta(
    null,
    "Tech jobs, government notifications and hackathons for freshers in India, checked every morning and sorted by deadline."
  );

  const [data, setData] = useState({ jobs: [], quizzes: [], news: [], loading: true });
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    Promise.all([
      axios.get("/api/jobs").then((r) => r.data).catch(() => []),
      axios.get("/api/quizzes").then((r) => r.data).catch(() => []),
      axios.get("/api/news").then((r) => r.data).catch(() => []),
    ]).then(([jobs, quizzes, news]) => setData({ jobs, quizzes, news, loading: false }));
    axios.get("/api/auth/users/count").then(({ data }) => setUserCount(data.count)).catch(() => {});
  }, []);

  const { jobs, quizzes, news, loading } = data;
  const newToday = [...jobs, ...quizzes].filter((i) => isToday(i.createdAt)).length;

  const closing = [
    ...jobs.map((j) => ({ id: j._id, title: j.title, org: j.company, deadline: j.deadline, kind: j.jobKind || "job", to: "/jobs" })),
    ...quizzes.map((q) => ({ id: q._id, title: q.title, org: q.organiser || q.platform, deadline: q.deadline, kind: "event", to: "/quizzes" })),
  ]
    .filter((i) => {
      const d = daysUntil(i.deadline);
      return d !== null && d >= 0;
    })
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
    .slice(0, 8);

  const tiles = [
    { to: "/jobs?kind=tech", label: "Tech jobs", count: jobs.filter((j) => j.jobKind === "tech").length, icon: HiOutlineBriefcase, tone: "tech" },
    { to: "/jobs?kind=govt", label: "Govt jobs", count: jobs.filter((j) => j.jobKind === "govt").length, icon: HiOutlineLibrary, tone: "govt" },
    { to: "/quizzes", label: "Hackathons", count: quizzes.length, icon: HiOutlineLightningBolt, tone: "event" },
    { to: "/news", label: "Tech news", count: news.length, icon: HiOutlineNewspaper, tone: "news" },
  ];

  const latest = [...jobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="page home">
      <section className="hello">
        <p className="hello-greet">{firstName ? `Hi ${firstName} 👋` : "Hi there 👋"}</p>
        <h1>
          {loading ? "Finding today's openings…" : newToday > 0 ? `${newToday} new ${newToday === 1 ? "opening" : "openings"} today` : "Fresh openings, every morning"}
        </h1>
        <p className="hello-sub">
          Jobs, government exams and hackathons for freshers. Every listing links to the official place to apply.
        </p>
        {!user && (
          <div className="hello-actions">
            <Link to="/register" className="btn btn-primary">Sign up free</Link>
            <Link to="/jobs" className="btn btn-ghost">Browse jobs</Link>
          </div>
        )}
        {userCount > 0 && <p className="hello-proof">{userCount.toLocaleString("en-IN")} students track deadlines here</p>}
      </section>

      <section className="tiles" aria-label="Categories">
        {tiles.map(({ to, label, count, icon: Icon, tone }) => (
          <Link key={label} to={to} className={`tile tile-${tone}`}>
            <span className="tile-icon"><Icon aria-hidden /></span>
            <span className="tile-count">{loading ? "–" : count}</span>
            <span className="tile-label">{label}</span>
          </Link>
        ))}
      </section>

      <section aria-labelledby="closing-title">
        <div className="section-head">
          <h2 id="closing-title">Closing soon</h2>
          <Link to="/jobs?sort=closing" className="see-all">See all <HiChevronRight aria-hidden /></Link>
        </div>
        {loading ? (
          <div className="skeleton-row" aria-hidden><span /><span /><span /></div>
        ) : closing.length === 0 ? (
          <p className="muted">Nothing closing in the next few weeks. New openings land every morning.</p>
        ) : (
          <div className="scroller">
            {closing.map((item) => {
              const pill = pillFor(item.deadline);
              return (
                <Link key={item.id} to={item.to} className={`mini mini-${["tech", "govt"].includes(item.kind) ? item.kind : item.kind === "event" ? "event" : "job"}`}>
                  <span className={`pill pill-${pill.tone}`}><span className="pill-dot" aria-hidden />{pill.text}</span>
                  <strong>{item.title}</strong>
                  <span className="mini-org">{item.org}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="latest-title">
        <div className="section-head">
          <h2 id="latest-title">Just added</h2>
          <Link to="/jobs" className="see-all">All jobs <HiChevronRight aria-hidden /></Link>
        </div>
        {loading ? (
          <div className="skeleton-card" aria-hidden />
        ) : latest.length === 0 ? (
          <p className="muted">No jobs yet. Check back tomorrow morning.</p>
        ) : (
          <div className="feed">
            {latest.map((job) => <JobCard key={job._id} job={job} />)}
          </div>
        )}
      </section>

      <a className="insta-card" href="https://www.instagram.com/beyond_the.offer" target="_blank" rel="noopener noreferrer">
        <FaInstagram className="insta-icon" aria-hidden />
        <span>
          <strong>Follow @beyond_the.offer</strong>
          New lists at 9 AM, 1 PM and 7 PM. Comment JOB on any post for the links.
        </span>
        <HiChevronRight aria-hidden />
      </a>
    </div>
  );
}

export default Home;
