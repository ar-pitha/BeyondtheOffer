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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quiz", quizSchema);
