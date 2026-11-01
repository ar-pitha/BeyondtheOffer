const express = require("express");
const { getNews, hideNews } = require("../controllers/newsController");
const { protect, adminOnly } = require("../controllers/authController");

const router = express.Router();

router.get("/", getNews);
router.delete("/:id", protect, adminOnly, hideNews);

module.exports = router;
