const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Quiz title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    link: {
      type: String,
      required: [true, "Quiz link is required"],
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
    deadline: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Automation (Google Sheet sync): every field below is optional
    externalId: { type: String, trim: true, unique: true, sparse: true },
    origin: { type: String, enum: ["admin", "auto"], default: "admin" },
    eventType: { type: String, enum: ["hackathon", "quiz", "ctf", "contest"] },
    organiser: { type: String, trim: true },
    prizes: { type: String, trim: true },
    eventDate: { type: Date },
    verified: { type: String, enum: ["Official", "Multi-source", "Single-source"] },
    isActive: { type: Boolean, default: true },
    adminEdited: { type: Boolean, default: false },
    extra: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quiz", quizSchema);
