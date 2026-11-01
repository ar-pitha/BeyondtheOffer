import { useState, useEffect } from "react";
import axios from "axios";
import usePageMeta from "../hooks/usePageMeta";
import { formatDate } from "../utils/deadline";

function News() {
  usePageMeta("Tech news", "Short tech news for students, and why each story matters for your career.");
  const [state, setState] = useState({ items: [], loading: true, error: "" });

  useEffect(() => {
    axios
      .get("/api/news")
      .then(({ data }) => setState({ items: data, loading: false, error: "" }))
      .catch(() => setState({ items: [], loading: false, error: "News didn't load. Check your connection." }));
  }, []);

  return (
    <>
      <header className="screen-head">
        <h1>News</h1>
      </header>

      {state.loading ? (
        <p className="note">Loading…</p>
      ) : state.error ? (
        <p className="note">{state.error}</p>
      ) : state.items.length === 0 ? (
        <div className="empty"><p>New stories every morning.</p></div>
      ) : (
        <ul className="stories">
          {state.items.map((n) => (
            <li key={n._id} className="story">
              <p className="story-meta">
                {[n.topic, formatDate(n.date), n.sourceName].filter(Boolean).join(" · ")}
              </p>
              {n.link ? (
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="story-title">{n.headline}</a>
              ) : (
                <span className="story-title">{n.headline}</span>
              )}
              {n.summary && <p className="story-text">{n.summary}</p>}
              {n.whyItMatters && <p className="story-why">{n.whyItMatters}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default News;
