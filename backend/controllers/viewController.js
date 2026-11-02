const Stat = require("../models/Stat");

const KEY = "siteViews";

// @desc    Total visits to the site
// @route   GET /api/views
const getSiteViews = async (req, res) => {
  try {
    const stat = await Stat.findOne({ key: KEY }).select("value");
    res.json({ views: stat?.value || 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Record one site visit (once per page load/refresh)
// @route   POST /api/views
const addSiteView = async (req, res) => {
  try {
    let stat;
    try {
      stat = await Stat.findOneAndUpdate(
        { key: KEY },
        { $inc: { value: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).select("value");
    } catch (error) {
      // Two first-time visits can race to create the counter.
      if (error?.code !== 11000) throw error;
      stat = await Stat.findOneAndUpdate(
        { key: KEY },
        { $inc: { value: 1 } },
        { new: true }
      ).select("value");
    }

    res.json({ views: stat.value });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSiteViews, addSiteView };
