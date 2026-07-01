import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { HiPlus, HiPencil, HiTrash } from "react-icons/hi";
import Modal from "../components/Modal";
import Loader from "../components/Loader";

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
};

function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchJobs = async () => {
    try {
      const { data } = await axios.get("/api/jobs");
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
    });
    setShowModal(true);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingId) {
        await axios.put(`/api/jobs/${editingId}`, form);
        toast.success("Job updated!");
      } else {
        await axios.post("/api/jobs", form);
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

  const filteredJobs = jobs.filter(j => 
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page container">
      <div className="admin-header">
        <h1>Manage Jobs</h1>
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
          <div style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search jobs by title or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Company</th>
                <th>Type</th>
                <th>Eligibility</th>
                <th>Platform</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job._id}>
                  <td>{job.title}</td>
                  <td>{job.company}</td>
                  <td><span className="badge badge-accent">{job.type}</span></td>
                  <td><span className="badge badge-warning">{job.eligibility || "Freshers & Experienced"}</span></td>
                  <td>{job.platform || "—"}</td>
                  <td>{new Date(job.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(job)}
                      >
                        <HiPencil />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(job._id)}
                      >
                        <HiTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default AdminJobs;
