const Job = require("../models/Job");

// @desc    Get all jobs
// @route   GET /api/jobs
const getJobs = async (req, res) => {
  try {
    // Items without isActive count as active. Admin pages pass ?includeInactive=true.
    const filter = req.query.includeInactive === "true" ? {} : { isActive: { $ne: false } };
    const jobs = await Job.find(filter).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a job
// @route   POST /api/jobs
const createJob = async (req, res) => {
  try {
    const { title, company, location, description, type, link, platform, eligibility, batch, experience, jobKind, deadline } =
      req.body;

    const job = await Job.create({
      title,
      company,
      location,
      description,
      type,
      link,
      platform,
      eligibility,
      batch,
      experience,
      jobKind: jobKind || undefined,
      deadline: deadline || undefined,
      postedBy: req.user._id,
    });

    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a job
// @route   PUT /api/jobs/:id
const updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // adminEdited stops the sheet sync from overwriting this edit
    const updatedJob = await Job.findByIdAndUpdate(req.params.id, { ...req.body, adminEdited: true }, {
      new: true,
      runValidators: true,
    });

    res.json(updatedJob);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a job
// @route   DELETE /api/jobs/:id
const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: "Job deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getJobs, createJob, updateJob, deleteJob };
