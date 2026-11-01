import OppCard from "./OppCard";

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
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function JobCard({ job }) {
  return (
    <OppCard
      id={job._id}
      kind={job.jobKind || "job"}
      org={job.company}
      title={job.title}
      verified={job.verified === "Official" || job.verified === "Multi-source"}
      facts={[
        job.location,
        job.type,
        job.batch && `Batch ${job.batch}`,
        job.salary,
        !job.batch && job.eligibility,
        job.experience && `Exp ${job.experience}`,
      ]}
      description={job.description}
      deadline={job.deadline}
      link={job.link}
      added={job.createdAt}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobPostingJsonLd(job) }} />
    </OppCard>
  );
}

export default JobCard;
