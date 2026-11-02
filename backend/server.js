const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const jobRoutes = require("./routes/jobRoutes");
const quizRoutes = require("./routes/quizRoutes");
const newsRoutes = require("./routes/newsRoutes");
const viewRoutes = require("./routes/viewRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Reuse connection across serverless invocations
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URI);
};

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ message: "Database connection failed" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/views", viewRoutes);

app.get("/", (req, res) => {
  res.json({ message: "BeyondTheOffer API is running" });
});

// Local dev only — Vercel does not call app.listen()
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB()
    .then(() => {
      console.log("✅ MongoDB connected");
      app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
      process.exit(1);
    });
}

module.exports = app;
