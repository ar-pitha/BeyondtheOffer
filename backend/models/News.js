const mongoose = require("mongoose");

// Tech news items synced from the "Tech_News" sheet tab
const newsSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true, trim: true },
    date: { type: Date, default: Date.now },
    headline: { type: String, required: [true, "Headline is required"], trim: true },
    summary: { type: String, default: "" },
    whyItMatters: { type: String, default: "" },
    topic: { type: String, trim: true, default: "" },
    sourceName: { type: String, trim: true, default: "" },
    link: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("News", newsSchema);
