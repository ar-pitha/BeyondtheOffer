// Pure functions that turn Google Sheet rows into Mongo documents.

export const TRUSTED = ["Official", "Multi-source"];

// Sheet dates are parsed in one place, shared with the admin panel (deadlines are end-of-day IST)
import { parseSheetDate } from "../../frontend/api/_lib/queue.js";
export { parseSheetDate };

export function mapJobType(value = "") {
  const v = value.toLowerCase();
  if (/intern/.test(v)) return "Internship";
  if (/part/.test(v)) return "Part-time";
  if (/contract|freelance/.test(v)) return "Contract";
  if (/remote|wfh/.test(v)) return "Remote";
  return "Full-time";
}

// The existing eligibility enum is about experience, not batch.
export function mapEligibility(value = "") {
  const v = value.toLowerCase();
  const fresher = /fresher|student|20\d\d|batch|graduat|final year|pursuing/.test(v);
  const experienced = /experience|yrs|years|\d\+?\s*y/.test(v) && !/0\s*-\s*\d|no experience/.test(v);
  if (fresher && !experienced) return "Freshers";
  if (experienced && !fresher) return "Experienced";
  return "Freshers & Experienced";
}

export function mapEventType(value = "") {
  const v = value.toLowerCase();
  if (/ctf|capture/.test(v)) return "ctf";
  if (/hack/.test(v)) return "hackathon";
  if (/quiz/.test(v)) return "quiz";
  return "contest";
}

const lines = (pairs) =>
  pairs
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

export function techRowToJob(r) {
  return {
    title: r.Role,
    company: r.Company,
    location: r.Location || "India",
    // Batch, salary and deadline already show as facts on the card, so keep this short
    description:
      r.Notes ||
      [`${mapJobType(r.Job_Type)} ${r.Category ? `${r.Category.toLowerCase()} ` : ""}role at ${r.Company}.`, r.Eligibility_Batch && `Open to ${r.Eligibility_Batch}.`]
        .filter(Boolean)
        .join(" "),
    type: mapJobType(r.Job_Type),
    link: r.Apply_Link,
    platform: r.Source || "",
    eligibility: mapEligibility(r.Eligibility_Batch),
    batch: r.Eligibility_Batch || "",
    jobKind: "tech",
    sector: r.Category || undefined,
    salary: r.Salary_Stipend || undefined,
    deadline: parseSheetDate(r.Apply_By),
    verified: r.Verified,
    sourceName: r.Source || undefined,
    extra: { jobType: r.Job_Type, dateAdded: r.Date_Added, notes: r.Notes },
  };
}

export function govtRowToJob(r) {
  return {
    title: r.Post_Exam,
    company: r.Organisation,
    location: "India",
    description:
      lines([
        ["Vacancies", r.Vacancies],
        ["Qualification", r.Qualification],
        ["Age limit", r.Age_Limit],
        ["Applications open", r.Application_Start],
        ["Last date", r.Last_Date],
      ]) + (r.Notes ? `\n\n${r.Notes}` : "") || `${r.Post_Exam}, ${r.Organisation}`,
    type: "Full-time",
    link: r.Official_Link || r.Notification_Link,
    platform: r.Source || "",
    eligibility: "Freshers & Experienced",
    batch: "",
    jobKind: "govt",
    sector: r.Sector || undefined,
    deadline: parseSheetDate(r.Last_Date),
    verified: r.Verified,
    sourceName: r.Source || undefined,
    extra: {
      vacancies: r.Vacancies,
      qualification: r.Qualification,
      ageLimit: r.Age_Limit,
      applicationStart: r.Application_Start,
      notificationLink: r.Notification_Link,
      dateAdded: r.Date_Added,
      notes: r.Notes,
    },
  };
}

export function eventRowToQuiz(r) {
  return {
    title: r.Name,
    // Organiser, prizes and dates already show on the card
    description:
      [r.Type && r.Organiser ? `${r.Type} by ${r.Organiser}.` : "", r.Eligibility ? `Open to ${r.Eligibility}.` : ""]
        .filter(Boolean)
        .join(" ") || r.Name,
    link: r.Link,
    platform: r.Organiser || "",
    eligibility: mapEligibility(r.Eligibility),
    deadline: parseSheetDate(r.Register_By),
    eventType: mapEventType(r.Type),
    organiser: r.Organiser || undefined,
    prizes: r.Prizes_Perks || undefined,
    eventDate: parseSheetDate(r.Event_Date) || undefined,
    verified: r.Verified,
    extra: { type: r.Type, eligibility: r.Eligibility, dateAdded: r.Date_Added },
  };
}

export function newsRowToNews(r) {
  return {
    date: parseSheetDate(r.Date) || new Date(),
    headline: r.Headline,
    summary: r.Summary || "",
    whyItMatters: r.Why_It_Matters_For_Students || "",
    topic: r.Topic || "",
    sourceName: r.Source || "",
    link: r.Link || "",
  };
}

// Required fields of the existing models; rows missing any of them are skipped.
export const REQUIRED = {
  job: ["title", "company", "location", "description", "link"],
  quiz: ["title", "description", "link"],
  news: ["headline"],
};

export const missingFields = (doc, kind) => REQUIRED[kind].filter((k) => !doc[k]);
