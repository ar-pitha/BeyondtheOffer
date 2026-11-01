import { HiExternalLink, HiGift, HiCalendar, HiUserGroup } from "react-icons/hi";
import DeadlineStub from "./DeadlineStub";
import { formatDate } from "../utils/deadline";

export const EVENT_LABELS = { hackathon: "Hackathon", quiz: "Quiz", ctf: "CTF", contest: "Contest" };

function QuizCard({ quiz }) {
  const trusted = quiz.verified === "Official" || quiz.verified === "Multi-source";

  return (
    <article className="ticket">
      <div className="ticket-main">
        {(quiz.eventType || trusted) && (
          <div className="ticket-tags">
            {quiz.eventType && <span className="tag tag-kind">{EVENT_LABELS[quiz.eventType]}</span>}
            {trusted && <span className="tag tag-verified">✓ {quiz.verified === "Official" ? "Official source" : "Checked in 2+ sources"}</span>}
          </div>
        )}

        <h3 className="ticket-title">{quiz.title}</h3>
        {(quiz.organiser || quiz.platform) && (
          <p className="ticket-org">
            <span>{quiz.organiser || quiz.platform}</span>
          </p>
        )}

        <div className="ticket-facts">
          {quiz.prizes && <span><HiGift aria-hidden /> {quiz.prizes}</span>}
          {quiz.eventDate && <span><HiCalendar aria-hidden /> Event {formatDate(quiz.eventDate)}</span>}
          {quiz.eligibility && <span><HiUserGroup aria-hidden /> {quiz.eligibility}</span>}
        </div>

        <p className="ticket-desc">{quiz.description}</p>

        <div className="ticket-foot">
          <small>
            {quiz.deadline ? `Register by ${formatDate(quiz.deadline, { day: "numeric", month: "short", year: "numeric" })}` : `Added ${formatDate(quiz.createdAt)}`}
          </small>
          <a href={quiz.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm btn-icon-mobile">
            <span className="btn-text">Register</span>
            <HiExternalLink aria-hidden />
          </a>
        </div>
      </div>

      <DeadlineStub deadline={quiz.deadline} />
    </article>
  );
}

export default QuizCard;
