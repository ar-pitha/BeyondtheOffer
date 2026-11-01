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

export default function useOpps() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });

  useEffect(() => {
    let alive = true;
    Promise.all([axios.get("/api/jobs"), axios.get("/api/quizzes")])
      .then(([jobs, events]) => {
        if (alive) setState({ items: [...jobs.data.map(fromJob), ...events.data.map(fromEvent)], loading: false, error: "" });
      })
      .catch(() => alive && setState({ items: [], loading: false, error: "Couldn't load openings. Check your connection and pull to refresh." }));
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
