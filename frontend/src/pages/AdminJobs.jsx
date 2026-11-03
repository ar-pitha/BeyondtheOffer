import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { HiPlus, HiPencil, HiTrash, HiX, HiCheck } from "react-icons/hi";
import Modal from "../components/Modal";
import Loader from "../components/Loader";
import Pagination from "../components/Pagination";

const emptyForm = {
  title: "",
  company: "",
  location: "",
  description: "",
  type: "Full-time",
  link: "",
  platform: "",
  eligibility: "Freshers & Experienced",
  batch: "",
  experience: "",
  jobKind: "",
  deadline: "",
};

const toDateInput = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");

function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [originFilter, setOriginFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);

  const fetchJobs = async () => {
    try {
      const { data } = await axios.get("/api/jobs?includeInactive=true");
      setJobs(data);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, originFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (job) => {
    setEditingId(job._id);
    setForm({
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      type: job.type,
      link: job.link,
      platform: job.platform || "",
      eligibility: job.eligibility || "Freshers & Experienced",
      batch: job.batch || "",
      experience: job.experience || "",
      jobKind: job.jobKind || "",
      deadline: toDateInput(job.deadline),
    });
    setShowModal(true);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    // Empty selects become null so the enum validators accept them
    const payload = { ...form, jobKind: form.jobKind || null, deadline: form.deadline || null };

    try {
      if (editingId) {
        await axios.put(`/api/jobs/${editingId}`, payload);
        toast.success("Job updated!");
      } else {
        await axios.post("/api/jobs", payload);
        toast.success("Job created!");
      }
      setShowModal(false);
      fetchJobs();
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this job?")) return;

    try {
      await axios.delete(`/api/jobs/${id}`);
      toast.success("Job deleted!");
      fetchJobs();
    } catch (error) {
      toast.error("Failed to delete job");
    }
  };

  if (loading) return <Loader />;

  const autoCount = jobs.filter((j) => j.origin === "auto").length;
  const filteredJobs = jobs.filter(
    (j) =>
      (originFilter === "all" || (originFilter === "auto" ? j.origin === "auto" : j.origin !== "auto")) &&
      (j.title.toLowerCase().includes(search.toLowerCase()) || j.company.toLowerCase().includes(search.toLowerCase()))
  );
  const visibleJobs = filteredJobs.slice((page - 1) * 10, page * 10);

  return (
    <div className="page container">
      <div className="admin-header">
        <h1>Jobs</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          <HiPlus /> Add Job
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h3>No jobs yet</h3>
          <p>Create your first job posting</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <div className="admin-toolbar">
            <input
              type="search"
              className="form-control"
              placeholder="Search by title or company"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="form-control" style={{ maxWidth: 240 }} value={originFilter} onChange={(e) => setOriginFilter(e.target.value)}>
              <option value="all">All sources ({jobs.length})</option>
              <option value="admin">Added by admins ({jobs.length - autoCount})</option>
              <option value="auto">From the sheet ({autoCount})</option>
            </select>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Company</th>
                <th>Kind</th>
                <th>Type</th>
                <th>Eligibility</th>
                <th>Deadline</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleJobs.map((job) => (
                <tr key={job._id} className={job.isActive === false ? "is-off" : ""}>
                  <td>
                    <span className="admin-title-cell">
                      {job.title}
                      {job.origin === "auto" && (
                        <span className="tag tag-auto" title={job.adminEdited ? "From the sheet, edited by an admin (sync skips it)" : "Synced from the Google Sheet"}>
                          {job.adminEdited ? "Auto, edited" : "Auto"}
                        </span>
                      )}
                      {job.isActive === false && <span className="tag tag-off" title="Expired or past deadline, so it is hidden from the site">Hidden</span>}
                    </span>
                  </td>
                  <td>{job.company}</td>
                  <td>{job.jobKind === "govt" ? "Govt" : job.jobKind === "tech" ? "Tech" : ""}</td>
                  <td>{job.type}</td>
                  <td>{job.eligibility || "Freshers & Experienced"}</td>
                  <td data-label="Closes">{job.deadline ? new Date(job.deadline).toLocaleDateString() : ""}</td>
                  <td data-label="Added">{new Date(job.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(job)}
                        aria-label={`Edit ${job.title}`}
                      >
                        <HiPencil />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(job._id)}
                        aria-label={`Delete ${job.title}`}
                      >
                        <HiTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={filteredJobs.length} onChange={setPage} />
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <Modal
          title={editingId ? "Edit Job" : "Create Job"}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label>Job Title</label>
                <input
                  name="title"
                  className="form-control"
                  placeholder="e.g. Frontend Developer"
                  value={form.title}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Company</label>
                  <input
                    name="company"
                    className="form-control"
                    placeholder="e.g. Google"
                    value={form.company}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input
                    name="location"
                    className="form-control"
                    placeholder="e.g. Bangalore, Remote"
                    value={form.location}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  className="form-control"
                  placeholder="Brief job description..."
                  value={form.description}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select
                    name="type"
                    className="form-control"
                    value={form.type}
                    onChange={handleChange}
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Internship</option>
                    <option>Contract</option>
                    <option>Remote</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Eligibility</label>
                  <select
                    name="eligibility"
                    className="form-control"
                    value={form.eligibility}
                    onChange={handleChange}
                  >
                    <option>Freshers</option>
                    <option>Experienced</option>
                    <option>Freshers & Experienced</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Batch / Passout Year</label>
                  <input
                    name="batch"
                    className="form-control"
                    placeholder="e.g. 2023, 2024, 2025"
                    value={form.batch}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Experience Required</label>
                  <input
                    name="experience"
                    className="form-control"
                    placeholder="e.g. 0-2 years"
                    value={form.experience}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Application Link</label>
                <input
                  name="link"
                  type="url"
                  className="form-control"
                  placeholder="https://unstop.com/..."
                  value={form.link}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select name="jobKind" className="form-control" value={form.jobKind} onChange={handleChange}>
                    <option value="">Not set</option>
                    <option value="tech">Tech</option>
                    <option value="govt">Govt</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Apply by (optional)</label>
                  <input name="deadline" type="date" className="form-control" value={form.deadline} onChange={handleChange} />
                </div>
              </div>
              {editingId && jobs.find((j) => j._id === editingId)?.origin === "auto" && (
                <p className="stat-note" style={{ marginBottom: "1rem" }}>
                  This job came from the Google Sheet. Saving marks it as edited, so the daily sync will not overwrite your changes.
                </p>
              )}
              <div className="form-group">
                <label>Platform (optional)</label>
                <input
                  name="platform"
                  className="form-control"
                  placeholder="e.g. LinkedIn, Naukri, Unstop"
                  value={form.platform}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-icon-mobile"
                onClick={() => setShowModal(false)}
              >
                <span className="btn-text">Cancel</span>
                <HiX />
              </button>
              <button type="submit" className="btn btn-primary btn-icon-mobile" disabled={submitting}>
                <span className="btn-text">{submitting ? "Saving..." : editingId ? "Update" : "Create"}</span>
                <HiCheck />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default AdminJobs;
