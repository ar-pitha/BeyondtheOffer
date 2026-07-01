import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { HiBriefcase, HiLightningBolt, HiUsers, HiPlus } from "react-icons/hi";
import Loader from "../components/Loader";

function AdminDashboard() {
  const [stats, setStats] = useState({ jobs: 0, quizzes: 0 });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [jobsRes, quizzesRes, usersRes] = await Promise.all([
          axios.get("/api/jobs"),
          axios.get("/api/quizzes"),
          axios.get("/api/auth/users"),
        ]);
        setStats({
          jobs: jobsRes.data.length,
          quizzes: quizzesRes.data.length,
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
        <h1>Admin Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.jobs}</div>
          <div className="stat-label">Total Jobs</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.quizzes}</div>
          <div className="stat-label">Total Quizzes</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{users.length}</div>
          <div className="stat-label">Total Users</div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem" }}>Quick Actions</h2>
      <div className="quick-actions">
        <Link to="/admin/jobs" className="quick-action-card">
          <div className="quick-action-icon"><HiBriefcase /></div>
          <div>
            <h4>Manage Jobs</h4>
            <p>Create, edit, and delete job postings</p>
          </div>
        </Link>

        <Link to="/admin/quizzes" className="quick-action-card">
          <div className="quick-action-icon"><HiLightningBolt /></div>
          <div>
            <h4>Manage Quizzes</h4>
            <p>Create, edit, and delete quiz postings</p>
          </div>
        </Link>
      </div>

      {/* Users Table */}
      <h2 style={{ margin: "2.5rem 0 1rem", fontSize: "1.25rem" }}>Registered Users</h2>
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
