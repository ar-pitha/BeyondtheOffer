import { useState, useEffect } from "react";
import axios from "axios";

// Jobs and events in one shape, so every list renders the same row.
// kind: "tech" | "govt" | "job" | "event"
export const fromJob = (j) => ({
  id: j._id,
  kind: j.jobKind || "job",
  title: j.title,
  org: j.company,
  // One line of facts; never repeat what the row already shows
  meta: [j.location !== "India" && j.location, j.type !== "Full-time" && j.type, j.batch && `Batch ${j.batch}`, j.salary]
    .filter(Boolean)
    .join(" · "),
  deadline: j.deadline,
  link: j.link,
  verified: j.verified === "Official" || j.verified === "Multi-source",
  createdAt: j.createdAt,
  raw: j,
});

export const fromEvent = (q) => ({
  id: q._id,
  kind: "event",
  title: q.title,
  org: q.organiser || q.platform,
  meta: [q.eventType && q.eventType[0].toUpperCase() + q.eventType.slice(1), q.prizes].filter(Boolean).join(" · "),
  deadline: q.deadline,
  link: q.link,
  verified: q.verified === "Official" || q.verified === "Multi-source",
  createdAt: q.createdAt,
  raw: q,
});

// A fresh copy is shown instantly when moving between pages; the network
// request is only repeated after the cache goes stale.
const TTL = 60_000;
let cache = null;
let inflight = null;

function loadOpps() {
  if (!inflight) {
    inflight = Promise.all([axios.get("/api/jobs"), axios.get("/api/quizzes")])
      .then(([jobs, events]) => {
        const items = [...jobs.data.map(fromJob), ...events.data.map(fromEvent)];
        cache = { items, at: Date.now() };
        return items;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export default function useOpps() {
  // Captured once, so writing the cache does not re-run the effect.
  const [fresh] = useState(() => Boolean(cache && Date.now() - cache.at < TTL));
  const [state, setState] = useState(() => ({
    items: fresh ? cache.items : [],
    loading: !fresh,
    error: "",
  }));

  useEffect(() => {
    if (fresh) return;

    let alive = true;
    loadOpps()
      .then((items) => {
        if (alive) setState({ items, loading: false, error: "" });
      })
      .catch(() => {
        if (!alive) return;
        setState((s) =>
          s.items.length
            ? { ...s, loading: false }
            : { items: [], loading: false, error: "Couldn't load openings. Check your connection and pull to refresh." }
        );
      });

    return () => {
      alive = false;
    };
  }, [fresh]);

  return state;
}
