import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import usePageMeta from "../hooks/usePageMeta";
import { daysUntil } from "../utils/deadline";
import { parseSheetDeadline } from "../utils/sheetDate";

const KIND = { tech: "Tech", govt: "Govt", event: "Event", news: "News" };

// Where "Comment JOB" replies and caption links land: the official links from one post.
function Links() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true });
  usePageMeta(state.data?.title || "Apply links", "Official apply links from our Instagram post.");

  useEffect(() => {
    setState({ loading: true });
    // A function on this site, not the backend API
    axios
      .get("/api/post-links", { baseURL: "", params: { id } })
      .then(({ data }) => setState({ data }))
      .catch((err) => setState({ error: err.response?.data?.message || "Links didn't load. Try again." }));
  }, [id]);

  if (state.loading) return <p className="note">Loading links…</p>;
  if (state.error) {
    return (
      <div className="empty">
        <p>{state.error}</p>
        <Link to="/" className="text-link">See all openings</Link>
      </div>
    );
  }

  const { data } = state;
  return (
    <>
      <header className="screen-head">
        <h1>{data.title}</h1>
      </header>
      {data.instagram && (
        <a href={data.instagram} target="_blank" rel="noopener noreferrer" className="text-link">From our Instagram post</a>
      )}

      <ul className="rows">
        {data.items.map((item) => {
          const n = item.deadline ? daysUntil(parseSheetDeadline(item.deadline)) : null;
          const closed = item.status === "Expired" || (n !== null && n < 0);
          const tone = n === null ? "open" : closed ? "closed" : n <= 3 ? "urgent" : n <= 7 ? "soon" : "later";
          return (
            <li key={item.id} className={`row row-${item.kind === "event" ? "event" : item.kind}`}>
              <div className="row-body">
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="row-title">{item.title}</a>
                <p className="row-org">
                  <span className={`kind kind-${item.kind}`}>{KIND[item.kind]}</span>
                  {item.org}
                </p>
                {item.detail && <p className="row-meta">{item.detail}</p>}
                <div className="row-actions">
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="apply">
                    {item.kind === "news" ? "Read" : closed ? "View" : "Apply"} →
                  </a>
                </div>
              </div>
              {item.kind !== "news" && (
                <span className={`stub stub-${tone}`}>
                  <b>{n === null || closed ? "–" : n}</b>
                  <small>{closed ? "closed" : n === null ? "open" : n === 0 ? "today" : n === 1 ? "day" : "days"}</small>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <Link to="/" className="more">See every opening</Link>
    </>
  );
}

export default Links;
