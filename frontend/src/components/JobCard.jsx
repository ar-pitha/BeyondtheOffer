import { HiExternalLink, HiLocationMarker, HiOfficeBuilding, HiAcademicCap, HiBriefcase, HiCurrencyRupee } from "react-icons/hi";
import DeadlineStub from "./DeadlineStub";
import { formatDate } from "../utils/deadline";

const EMPLOYMENT_TYPE = {
  "Full-time": "FULL_TIME",
  "Part-time": "PART_TIME",
  Internship: "INTERN",
  Contract: "CONTRACTOR",
  Remote: "FULL_TIME",
};

// schema.org JobPosting so search engines can list the opening
function jobPostingJsonLd(job) {
  const data = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.createdAt,
    employmentType: EMPLOYMENT_TYPE[job.type] || "FULL_TIME",
    hiringOrganization: { "@type": "Organization", name: job.company },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: job.location, addressCountry: "IN" },
    },
    url: job.link,
  };
  if (job.deadline) data.validThrough = job.deadline;
  if (job.type === "Remote") data.jobLocationType = "TELECOMMUTE";
  return JSON.stringify(data).replace(/</g, "\u003c");
}

function JobCard({ job }) {
  const trusted = job.verified === "Official" || job.verified === "Multi-source";

  return (
    <article className="ticket">
      <div className="ticket-main">
        {(job.jobKind || trusted) && (
          <div className="ticket-tags">
            {job.jobKind === "govt" && <span className="tag tag-kind">Govt</span>}
            {job.jobKind === "tech" && <span className="tag tag-kind">Tech</span>}
            {trusted && <span className="tag tag-verified">✓ {job.verified === "Official" ? "Official source" : "Checked in 2+ sources"}</span>}
          </div>
        )}

        <h3 className="ticket-title">{job.title}</h3>
        <p className="ticket-org">
          <span><HiOfficeBuilding aria-hidden /> {job.company}</span>
          <span><HiLocationMarker aria-hidden /> {job.location}</span>
        </p>

        <div className="ticket-facts">
          <span><HiBriefcase aria-hidden /> {job.type}</span>
          {job.batch && <span><HiAcademicCap aria-hidden /> Batch {job.batch}</span>}
          {job.salary && <span><HiCurrencyRupee aria-hidden /> {job.salary}</span>}
          {!job.batch && job.eligibility && <span>{job.eligibility}</span>}
          {job.experience && <span>Exp: {job.experience}</span>}
          {job.sector && <span>{job.sector}</span>}
        </div>

        <p className="ticket-desc">{job.description}</p>

        <div className="ticket-foot">
          <small>{job.platform ? `Via ${job.platform}, added ` : "Added "}{formatDate(job.createdAt)}</small>
          <a href={job.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm btn-icon-mobile">
            <span className="btn-text">Apply</span>
            <HiExternalLink aria-hidden />
          </a>
        </div>
      </div>

      <DeadlineStub deadline={job.deadline} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobPostingJsonLd(job) }} />
    </article>
  );
}

export default JobCard;
