const Quiz = require("../models/Quiz");

// @desc    Get all quizzes
// @route   GET /api/quizzes
const getQuizzes = async (req, res) => {
  try {
    // Items without isActive count as active. Admin pages pass ?includeInactive=true.
    const filter = req.query.includeInactive === "true" ? {} : { isActive: { $ne: false } };
    const quizzes = await Quiz.find(filter).sort({ createdAt: -1 });
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a quiz
// @route   POST /api/quizzes
const createQuiz = async (req, res) => {
  try {
    const { title, description, link, platform, deadline, eligibility, eventType } = req.body;

    const quiz = await Quiz.create({
      title,
      description,
      link,
      platform,
      deadline: deadline || null,
      eligibility,
      eventType: eventType || undefined,
      createdBy: req.user._id,
    });

    res.status(201).json(quiz);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a quiz
// @route   PUT /api/quizzes/:id
const updateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // adminEdited stops the sheet sync from overwriting this edit
    const updatedQuiz = await Quiz.findByIdAndUpdate(
      req.params.id,
      { ...req.body, adminEdited: true },
      { new: true, runValidators: true }
    );

    res.json(updatedQuiz);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a quiz
// @route   DELETE /api/quizzes/:id
const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    await Quiz.findByIdAndDelete(req.params.id);
    res.json({ message: "Quiz deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getQuizzes, createQuiz, updateQuiz, deleteQuiz };
