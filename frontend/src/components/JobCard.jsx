import { HiExternalLink, HiLocationMarker, HiOfficeBuilding, HiAcademicCap, HiCalendar, HiBriefcase } from "react-icons/hi";

function JobCard({ job }) {
  return (
    <div className="card">
      <h3 className="card-title">{job.title}</h3>
      <p className="card-subtitle">
        <HiOfficeBuilding style={{ verticalAlign: "middle", marginRight: 4 }} />
        {job.company}
        <span style={{ margin: "0 8px", opacity: 0.3 }}>•</span>
        <HiLocationMarker style={{ verticalAlign: "middle", marginRight: 4 }} />
        {job.location}
      </p>

      {/* Meta details (plain text, no badges) */}
      <div className="card-meta">
        <span><HiBriefcase style={{ verticalAlign: "middle", marginRight: 4 }} /> {job.type}</span>
        {job.eligibility && (
          <span><span style={{ margin: "0 8px", opacity: 0.3 }}>•</span> {job.eligibility}</span>
        )}
        {job.platform && (
          <span><span style={{ margin: "0 8px", opacity: 0.3 }}>•</span> {job.platform}</span>
        )}
      </div>
      <div className="card-meta">
        {job.batch && (
          <span><HiAcademicCap style={{ verticalAlign: "middle", marginRight: 4 }} /> Batch: {job.batch}</span>
        )}
        {job.experience && (
          <span><span style={{ margin: "0 8px", opacity: 0.3 }}>•</span> Exp: {job.experience}</span>
        )}
      </div>

      <p className="card-description">{job.description}</p>
      <div className="card-footer">
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {new Date(job.createdAt).toLocaleDateString()}
        </span>
        <a
          href={job.link}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm btn-icon-mobile"
        >
          <span className="btn-text">Apply Now</span>
          <HiExternalLink />
        </a>
      </div>
    </div>
  );
}

export default JobCard;
