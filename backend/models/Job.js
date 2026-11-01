const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
    },
    company: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    type: {
      type: String,
      enum: ["Full-time", "Part-time", "Internship", "Contract", "Remote"],
      default: "Full-time",
    },
    link: {
      type: String,
      required: [true, "Application link is required"],
    },
    platform: {
      type: String,
      trim: true,
      default: "",
    },
    eligibility: {
      type: String,
      enum: ["Freshers", "Experienced", "Freshers & Experienced"],
      default: "Freshers & Experienced",
    },
    batch: {
      type: String,
      trim: true,
      default: "",
    },
    experience: {
      type: String,
      trim: true,
      default: "",
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Automation (Google Sheet sync): every field below is optional
    externalId: { type: String, trim: true, unique: true, sparse: true },
    origin: { type: String, enum: ["admin", "auto"], default: "admin" },
    jobKind: { type: String, enum: ["tech", "govt"] },
    sector: { type: String, trim: true },
    salary: { type: String, trim: true },
    deadline: { type: Date },
    verified: { type: String, enum: ["Official", "Multi-source", "Single-source"] },
    sourceName: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    adminEdited: { type: Boolean, default: false },
    extra: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", jobSchema);
