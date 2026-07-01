const express = require("express");
const { register, login, googleAuth, getMe, getUsers, getUsersCount, protect, adminOnly } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.get("/me", protect, getMe);
router.get("/users/count", getUsersCount);
router.get("/users", protect, adminOnly, getUsers);

module.exports = router;
