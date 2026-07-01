import { HiExternalLink, HiClock } from "react-icons/hi";

function QuizCard({ quiz }) {
  const deadlineText = quiz.deadline
    ? new Date(quiz.deadline).toLocaleDateString()
    : "No deadline";

  return (
    <div className="card">
      <h3 className="card-title">{quiz.title}</h3>
      <div className="card-meta">
        {quiz.platform && (
          <span>{quiz.platform}</span>
        )}
        {quiz.eligibility && (
          <span>
            {quiz.platform && <span style={{ margin: "0 8px", opacity: 0.3 }}>•</span>}
            {quiz.eligibility}
          </span>
        )}
      </div>
      {quiz.deadline && (
        <div className="card-meta">
          <span><HiClock style={{ verticalAlign: "middle", marginRight: 4 }} /> {deadlineText}</span>
        </div>
      )}
      <p className="card-description">{quiz.description}</p>
      <div className="card-footer">
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {new Date(quiz.createdAt).toLocaleDateString()}
        </span>
        <a
          href={quiz.link}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm"
        >
          Participate <HiExternalLink />
        </a>
      </div>
    </div>
  );
}

export default QuizCard;
