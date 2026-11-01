import OppCard, { KIND_LABELS } from "./OppCard";
import { formatDate } from "../utils/deadline";

export const EVENT_LABELS = { hackathon: "Hackathon", quiz: "Quiz", ctf: "CTF", contest: "Contest" };
export { KIND_LABELS };

function QuizCard({ quiz }) {
  return (
    <OppCard
      id={quiz._id}
      kind={quiz.eventType || "contest"}
      org={quiz.organiser || quiz.platform || "Event"}
      title={quiz.title}
      verified={quiz.verified === "Official" || quiz.verified === "Multi-source"}
      facts={[
        quiz.prizes && `🏆 ${quiz.prizes}`,
        quiz.eventDate && `Event ${formatDate(quiz.eventDate)}`,
        quiz.eligibility,
      ]}
      description={quiz.description}
      deadline={quiz.deadline}
      link={quiz.link}
      actionLabel="Register"
      added={quiz.createdAt}
    />
  );
}

export default QuizCard;
