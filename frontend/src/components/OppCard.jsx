import { HiOutlineBookmark, HiBookmark, HiCheckCircle, HiExternalLink } from "react-icons/hi";
import useSaved from "../hooks/useSaved";
import { pillFor, formatDate } from "../utils/deadline";

export const KIND_LABELS = { tech: "Tech", govt: "Govt", hackathon: "Hackathon", quiz: "Quiz", ctf: "CTF", contest: "Contest", job: "Job", news: "News" };

const initials = (name = "") =>
  name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

// One opportunity (job or event) as an app-style card.
// kind: tech | govt | hackathon | quiz | ctf | contest | job; colour comes from the kind.
function OppCard({ id, kind = "job", org, title, facts = [], description, deadline, link, verified, actionLabel = "Apply", added, children }) {
  const { isSaved, toggle } = useSaved();
  const pill = pillFor(deadline);
  const saved = isSaved(id);
  const tone = ["tech", "govt"].includes(kind) ? kind : ["hackathon", "quiz", "ctf", "contest"].includes(kind) ? "event" : "job";

  return (
    <article className={`opp opp-${tone}`}>
      <header className="opp-head">
        <span className="opp-avatar" aria-hidden>{initials(org || title)}</span>
        <div className="opp-org">
          <span className="opp-org-name">
            {org}
            {verified && <HiCheckCircle className="opp-verified" title="Checked against the official source" aria-label="Verified" />}
          </span>
          <span className="opp-kind">{KIND_LABELS[kind] || "Job"}{added ? ` · added ${formatDate(added)}` : ""}</span>
        </div>
        <button
          className={`icon-btn opp-save ${saved ? "is-on" : ""}`}
          onClick={() => toggle(id)}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
        >
          {saved ? <HiBookmark /> : <HiOutlineBookmark />}
        </button>
      </header>

      <h3 className="opp-title">{title}</h3>

      {facts.filter(Boolean).length > 0 && (
        <ul className="opp-facts">
          {facts.filter(Boolean).map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}

      {description && <p className="opp-desc">{description}</p>}
      {children}

      <footer className="opp-foot">
        <span className={`pill pill-${pill.tone}`}>
          <span className="pill-dot" aria-hidden />
          {pill.text}
        </span>
        <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          {actionLabel} <HiExternalLink aria-hidden />
        </a>
      </footer>
    </article>
  );
}

export default OppCard;
