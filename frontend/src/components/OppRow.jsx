import { HiOutlineBookmark, HiBookmark } from "react-icons/hi";
import useSaved from "../hooks/useSaved";
import { daysUntil, formatDate } from "../utils/deadline";

const KIND = { tech: "Tech", govt: "Govt", job: "Job", event: "Event" };

// Small stub on the right: the one number students act on
function Stub({ deadline }) {
  const n = daysUntil(deadline);
  let big, small, tone;
  if (n === null) [big, small, tone] = ["–", "open", "open"];
  else if (n < 0) [big, small, tone] = ["–", "closed", "closed"];
  else if (n === 0) [big, small, tone] = ["0", "today", "urgent"];
  else if (n <= 99) [big, small, tone] = [String(n), n === 1 ? "day" : "days", n <= 3 ? "urgent" : n <= 7 ? "soon" : "later"];
  else [big, small, tone] = [formatDate(deadline, { day: "numeric" }), formatDate(deadline, { month: "short" }), "later"];
  return (
    <span className={`stub stub-${tone}`} aria-label={n === null ? "No deadline" : n < 0 ? "Closed" : `${n} days left`}>
      <b>{big}</b>
      <small>{small}</small>
    </span>
  );
}

// schema.org JobPosting so search engines can list jobs
function jobJsonLd(o) {
  const j = o.raw;
  const data = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: j.title,
    description: j.description,
    datePosted: j.createdAt,
    hiringOrganization: { "@type": "Organization", name: j.company },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: j.location, addressCountry: "IN" } },
    url: j.link,
  };
  if (j.deadline) data.validThrough = j.deadline;
  // Escape "<" so a title containing "</script>" can't break out of the tag
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// One opening as a flat row: title, organisation, one line of facts, Apply, and the days-left stub.
function OppRow({ opp, canSave = true }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(opp.id);

  return (
    <li className={`row row-${opp.kind}`}>
      <div className="row-body">
        <a href={opp.link} target="_blank" rel="noopener noreferrer" className="row-title">
          {opp.title}
        </a>
        <p className="row-org">
          <span className={`kind kind-${opp.kind}`}>{KIND[opp.kind]}</span>
          {opp.org}
          {opp.verified && <span className="tick" title="Checked against the official source" aria-label="verified">✓</span>}
        </p>
        {opp.meta && <p className="row-meta">{opp.meta}</p>}
        <div className="row-actions">
          <a href={opp.link} target="_blank" rel="noopener noreferrer" className="apply">
            {opp.kind === "event" ? "Register" : "Apply"} →
          </a>
          {canSave && (
          <button
            className={`save ${saved ? "is-on" : ""}`}
            onClick={() => toggle(opp.id)}
            aria-pressed={saved}
            aria-label={saved ? "Remove from saved" : "Save"}
          >
            {saved ? <HiBookmark /> : <HiOutlineBookmark />}
          </button>
          )}
        </div>
      </div>
      <Stub deadline={opp.deadline} />
      {opp.kind !== "event" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobJsonLd(opp) }} />}
    </li>
  );
}

export default OppRow;
