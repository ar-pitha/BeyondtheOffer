import { useState, useEffect } from "react";
import axios from "axios";
import Loader from "../components/Loader";

function AdminDashboard() {
  const [stats, setStats] = useState({ jobs: 0, quizzes: 0, news: 0, autoJobs: 0, autoQuizzes: 0, hidden: 0 });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [jobsRes, quizzesRes, usersRes, newsRes] = await Promise.all([
          axios.get("/api/jobs?includeInactive=true"),
          axios.get("/api/quizzes?includeInactive=true"),
          axios.get("/api/auth/users"),
          axios.get("/api/news?limit=100").catch(() => ({ data: [] })),
        ]);
        const live = (list) => list.filter((i) => i.isActive !== false);
        setStats({
          jobs: live(jobsRes.data).length,
          quizzes: live(quizzesRes.data).length,
          news: newsRes.data.length,
          autoJobs: live(jobsRes.data).filter((j) => j.origin === "auto").length,
          autoQuizzes: live(quizzesRes.data).filter((q) => q.origin === "auto").length,
          hidden: jobsRes.data.length + quizzesRes.data.length - live(jobsRes.data).length - live(quizzesRes.data).length,
        });
        setUsers(usersRes.data);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="page container">
      <div className="admin-header">
        <h1>Overview</h1>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.jobs}</div>
          <div className="stat-label">Live jobs</div>
          <div className="stat-note">{stats.autoJobs} from the sheet</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.quizzes}</div>
          <div className="stat-label">Live events</div>
          <div className="stat-note">{stats.autoQuizzes} from the sheet</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.news}</div>
          <div className="stat-label">News stories</div>
          <div className="stat-note">{stats.hidden} expired items hidden</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{users.length}</div>
          <div className="stat-label">Registered users</div>
        </div>
      </div>

      <h2 className="admin-section-title">Registered users</h2>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined Date</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={u.role === 'admin' ? 'badge-primary' : ''} style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    backgroundColor: u.role === 'admin' ? "var(--accent-glow)" : "var(--bg-card-hover)",
                    color: u.role === 'admin' ? "var(--text-primary)" : "var(--text-secondary)",
                    textTransform: "capitalize",
                    fontWeight: 600
                  }}>
                    {u.role}
                  </span>
                </td>
                <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: "center", padding: "2rem" }}>No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminDashboard;
