const express = require("express");
const { getQuizzes, createQuiz, updateQuiz, deleteQuiz } = require("../controllers/quizController");
const { protect, adminOnly } = require("../controllers/authController");

const router = express.Router();

router.get("/", getQuizzes);
router.post("/", protect, adminOnly, createQuiz);
router.put("/:id", protect, adminOnly, updateQuiz);
router.delete("/:id", protect, adminOnly, deleteQuiz);

module.exports = router;
