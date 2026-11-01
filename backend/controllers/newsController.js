const News = require("../models/News");

// @desc    Get latest active tech news
// @route   GET /api/news
const getNews = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const news = await News.find({ isActive: { $ne: false } })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit);
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Hide a news item (sync never deletes, so admins hide instead)
// @route   DELETE /api/news/:id
const hideNews = async (req, res) => {
  try {
    const item = await News.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!item) {
      return res.status(404).json({ message: "News item not found" });
    }
    res.json({ message: "News item hidden" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getNews, hideNews };
