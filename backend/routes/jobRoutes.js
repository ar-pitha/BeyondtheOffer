const express = require("express");
const { getJobs, createJob, updateJob, deleteJob } = require("../controllers/jobController");
const { protect, adminOnly } = require("../controllers/authController");

const router = express.Router();

router.get("/", getJobs);
router.post("/", protect, adminOnly, createJob);
router.put("/:id", protect, adminOnly, updateJob);
router.delete("/:id", protect, adminOnly, deleteJob);

module.exports = router;
