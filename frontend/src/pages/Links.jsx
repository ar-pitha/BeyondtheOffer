import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { FaInstagram } from "react-icons/fa";
import { HiExternalLink } from "react-icons/hi";
import Loader from "../components/Loader";
import usePageMeta from "../hooks/usePageMeta";
import { pillFor } from "../utils/deadline";
import { parseSheetDeadline } from "../utils/sheetDate";

const KIND = { tech: "Tech job", govt: "Govt job", event: "Hackathon", news: "News" };

// The page people land on from "Comment JOB" replies and the link in each caption.
function Links() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true });
  usePageMeta(state.data?.title ? `Links: ${state.data.title}` : "Apply links", "Official apply links for every opening in our Instagram post.");

  useEffect(() => {
    setState({ loading: true });
    // This endpoint is a function on this site, not the backend API
    axios
      .get("/api/post-links", { baseURL: "", params: { id }, headers: { Authorization: undefined } })
      .then(({ data }) => setState({ data }))
      .catch((err) => setState({ error: err.response?.data?.message || "Links didn't load. Check your connection and try again." }));
  }, [id]);

  if (state.loading) return <Loader />;

  if (state.error) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>{state.error}</h3>
          <Link to="/jobs" className="btn btn-primary">See all jobs</Link>
        </div>
      </div>
    );
  }

  const { data } = state;
  return (
    <div className="page links-page">
      <header className="page-header">
        <p className="eyebrow-ig"><FaInstagram aria-hidden /> From our post</p>
        <h1>{data.title}</h1>
        <p>
          {data.items.length} official {data.items.length === 1 ? "link" : "links"}. Tap to open the source and apply.
        </p>
        {data.instagram && (
          <a href={data.instagram} target="_blank" rel="noopener noreferrer" className="link-button">
            View the post on Instagram
          </a>
        )}
      </header>

      {data.items.length === 0 ? (
        <div className="empty-state">
          <h3>This post has no apply links</h3>
          <Link to="/jobs" className="btn btn-primary">See all jobs</Link>
        </div>
      ) : (
        <ol className="link-list">
          {data.items.map((item) => {
            const pill = item.deadline ? pillFor(parseSheetDeadline(item.deadline)) : null;
            const closed = item.status === "Expired" || pill?.tone === "closed";
            return (
              <li key={item.id} className={`link-item link-${item.kind} ${closed ? "is-closed" : ""}`}>
                <div className="link-body">
                  <span className="link-kind">{KIND[item.kind] || "Opening"}</span>
                  <strong>{item.title}</strong>
                  <span className="link-org">{item.org}</span>
                  {item.detail && <span className="link-detail">{item.detail}</span>}
                </div>
                <div className="link-side">
                  {pill && <span className={`pill pill-${pill.tone}`}><span className="pill-dot" aria-hidden />{pill.text}</span>}
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    {item.kind === "news" ? "Read" : closed ? "View" : "Apply"} <HiExternalLink aria-hidden />
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="links-more">
        <p>New openings every morning, sorted by deadline.</p>
        <Link to="/jobs" className="btn btn-ghost">Browse all jobs</Link>
      </div>
    </div>
  );
}

export default Links;
