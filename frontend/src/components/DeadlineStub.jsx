import { stubFor } from "../utils/deadline";

// Perforated right edge of a ticket: days left until the deadline.
function DeadlineStub({ deadline }) {
  const { big, small, tone } = stubFor(deadline);
  const isWord = !/^\d+$/.test(big);
  return (
    <div className={`ticket-stub tone-${tone}`} aria-label={isWord ? `${big}, ${small}` : `${big} ${small}`}>
      <span className={`stub-big ${isWord ? "is-word" : ""}`}>{big}</span>
      <span className="stub-small">{small}</span>
    </div>
  );
}

export default DeadlineStub;
