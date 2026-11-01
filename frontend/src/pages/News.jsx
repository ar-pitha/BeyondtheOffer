import { useState, useEffect } from "react";
import axios from "axios";
import Loader from "../components/Loader";
import usePageMeta from "../hooks/usePageMeta";
import { formatDate } from "../utils/deadline";
import { HiExternalLink } from "react-icons/hi";

function News() {
  usePageMeta(
    "Tech news for students",
    "Short tech news summaries for students and freshers, with why each story matters for your career."
  );

  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("");

  useEffect(() => {
    axios
      .get("/api/news")
      .then(({ data }) => setNews(data))
      .catch(() => setError("News didn't load. Check your connection and refresh the page."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  const topics = [...new Set(news.map((n) => n.topic).filter(Boolean))];
  const visible = topic ? news.filter((n) => n.topic === topic) : news;

  return (
    <div className="page container">
      <header className="page-header">
        <h1>Tech news</h1>
        <p>What happened in tech this week, in plain words, and why it matters if you're job hunting.</p>
      </header>

      {topics.length > 1 && (
        <div className="chips" role="group" aria-label="Topic">
          <button className="chip" aria-pressed={topic === ""} onClick={() => setTopic("")}>
            All
          </button>
          {topics.map((t) => (
            <button key={t} className="chip" aria-pressed={topic === t} onClick={() => setTopic(t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <div className="empty-state">
          <h3>{error}</h3>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <h3>No news yet</h3>
          <p>Stories are added every morning. Check back tomorrow.</p>
        </div>
      ) : (
        <div className="news-list">
          {visible.map((item) => (
            <article key={item._id} className="news-item">
              <div className="news-date">
                <time dateTime={item.date}>{formatDate(item.date, { day: "numeric", month: "short", year: "numeric" })}</time>
                {item.topic && <span>{item.topic}</span>}
              </div>
              <div>
                <h2>
                  {item.link ? (
                    <a href={item.link} target="_blank" rel="noopener noreferrer">{item.headline}</a>
                  ) : (
                    item.headline
                  )}
                </h2>
                {item.summary && <p>{item.summary}</p>}
                {item.whyItMatters && (
                  <div className="news-why">
                    <b>Why it matters for you</b>
                    {item.whyItMatters}
                  </div>
                )}
                {item.link && (
                  <a className="news-source" href={item.link} target="_blank" rel="noopener noreferrer">
                    Read on {item.sourceName || "the source"} <HiExternalLink aria-hidden />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default News;
