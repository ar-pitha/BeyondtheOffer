import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { HiPlus, HiPencil, HiTrash, HiX, HiCheck } from "react-icons/hi";
import Modal from "../components/Modal";
import Loader from "../components/Loader";
import Pagination from "../components/Pagination";

const emptyForm = {
  title: "",
  description: "",
  link: "",
  platform: "",
  deadline: "",
  eligibility: "Freshers & Experienced",
  eventType: "",
};

const EVENT_LABELS = { hackathon: "Hackathon", quiz: "Quiz", ctf: "CTF", contest: "Contest" };

function AdminQuizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);

  const fetchQuizzes = async () => {
    try {
      const { data } = await axios.get("/api/quizzes?includeInactive=true");
      setQuizzes(data);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (quiz) => {
    setEditingId(quiz._id);
    setForm({
      title: quiz.title,
      description: quiz.description,
      link: quiz.link,
      platform: quiz.platform,
      eligibility: quiz.eligibility || "Freshers & Experienced",
      eventType: quiz.eventType || "",
      deadline: quiz.deadline
        ? new Date(quiz.deadline).toISOString().split("T")[0]
        : "",
    });
    setShowModal(true);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      ...form,
      deadline: form.deadline || null,
      eventType: form.eventType || null,
    };

    try {
      if (editingId) {
        await axios.put(`/api/quizzes/${editingId}`, payload);
        toast.success("Quiz updated!");
      } else {
        await axios.post("/api/quizzes", payload);
        toast.success("Quiz created!");
      }
      setShowModal(false);
      fetchQuizzes();
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this quiz?")) return;

    try {
      await axios.delete(`/api/quizzes/${id}`);
      toast.success("Quiz deleted!");
      fetchQuizzes();
    } catch (error) {
      toast.error("Failed to delete quiz");
    }
  };

  if (loading) return <Loader />;

  const filteredQuizzes = quizzes.filter(q =>
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    (q.platform && q.platform.toLowerCase().includes(search.toLowerCase())) ||
    (q.description && q.description.toLowerCase().includes(search.toLowerCase()))
  );
  const visibleQuizzes = filteredQuizzes.slice((page - 1) * 10, page * 10);

  return (
    <div className="page container">
      <div className="admin-header">
        <h1>Events</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          <HiPlus /> Add Quiz
        </button>
      </div>

      {quizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧩</div>
          <h3>No quizzes yet</h3>
          <p>Create your first quiz posting</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <div style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search quizzes by title, platform, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Platform</th>
                <th>Eligibility</th>
                <th>Deadline</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleQuizzes.map((quiz) => (
                <tr key={quiz._id} className={quiz.isActive === false ? "is-off" : ""}>
                  <td>
                    <span className="admin-title-cell">
                      {quiz.title}
                      {quiz.eventType && <span className="tag tag-kind">{EVENT_LABELS[quiz.eventType]}</span>}
                      {quiz.origin === "auto" && (
                        <span className="tag tag-auto" title={quiz.adminEdited ? "From the sheet, edited by an admin (sync skips it)" : "Synced from the Google Sheet"}>
                          {quiz.adminEdited ? "Auto, edited" : "Auto"}
                        </span>
                      )}
                      {quiz.isActive === false && <span className="tag tag-off" title="Expired or past deadline, so it is hidden from the site">Hidden</span>}
                    </span>
                  </td>
                  <td>{quiz.platform || ""}</td>
                  <td>{quiz.eligibility || "Freshers & Experienced"}</td>
                  <td data-label="Closes">{quiz.deadline ? new Date(quiz.deadline).toLocaleDateString() : ""}</td>
                  <td data-label="Added">{new Date(quiz.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(quiz)}
                      >
                        <HiPencil />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(quiz._id)}
                      >
                        <HiTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={filteredQuizzes.length} onChange={setPage} />
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <Modal
          title={editingId ? "Edit Quiz" : "Create Quiz"}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label>Quiz Title</label>
                <input
                  name="title"
                  className="form-control"
                  placeholder="e.g. Unstop Coding Challenge"
                  value={form.title}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  className="form-control"
                  placeholder="Brief description of the quiz..."
                  value={form.description}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Quiz Link</label>
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
                  placeholder="e.g. Unstop, HackerRank"
                  value={form.platform}
                  onChange={handleChange}
                />
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
              <div className="form-group">
                <label>Event type</label>
                <select name="eventType" className="form-control" value={form.eventType} onChange={handleChange}>
                  <option value="">Not set</option>
                  <option value="hackathon">Hackathon</option>
                  <option value="quiz">Quiz</option>
                  <option value="ctf">CTF</option>
                  <option value="contest">Contest</option>
                </select>
              </div>
              <div className="form-group">
                <label>Deadline (optional)</label>
                <input
                  name="deadline"
                  type="date"
                  className="form-control"
                  value={form.deadline}
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

export default AdminQuizzes;
