import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import axios from "axios";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Jobs from "./pages/Jobs";
import Quizzes from "./pages/Quizzes";
import AdminDashboard from "./pages/AdminDashboard";
import AdminJobs from "./pages/AdminJobs";
import AdminQuizzes from "./pages/AdminQuizzes";

// Set Axios base URL
axios.defaults.baseURL = import.meta.env.VITE_API_URL;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Load user from storage on mount
  useEffect(() => {
    const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      axios.defaults.headers.common["Authorization"] = `Bearer ${parsed.token}`;
    }
    setLoading(false);
  }, []);

  // Login handler
  const loginUser = (userData, rememberMe) => {
    setUser(userData);
    if (rememberMe) {
      localStorage.setItem("user", JSON.stringify(userData));
    } else {
      sessionStorage.setItem("user", JSON.stringify(userData));
    }
    axios.defaults.headers.common["Authorization"] = `Bearer ${userData.token}`;
  };

  // Logout handler
  const logoutUser = () => {
    setUser(null);
    localStorage.removeItem("user");
    sessionStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
  };

  if (loading) return null;

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: theme === "dark" ? "#1a1a2e" : "#ffffff",
            color: theme === "dark" ? "#eeeef5" : "#1a1a2e",
            border: `1px solid ${theme === "dark" ? "#2e2e48" : "#e2e4ea"}`,
          },
        }}
      />
      <Navbar user={user} onLogout={logoutUser} theme={theme} onToggleTheme={toggleTheme} />

      <Routes>
        {/* Public routes */}
        <Route path="/" element={user ? <Navigate to={user.role === "admin" ? "/admin" : "/jobs"} /> : <Home />} />
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={loginUser} />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register onLogin={loginUser} />} />
        <Route path="/jobs" element={<ProtectedRoute user={user}><Jobs /></ProtectedRoute>} />
        <Route path="/quizzes" element={<ProtectedRoute user={user}><Quizzes /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user} adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs"
          element={
            <ProtectedRoute user={user} adminOnly>
              <AdminJobs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/quizzes"
          element={
            <ProtectedRoute user={user} adminOnly>
              <AdminQuizzes />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <Footer />
    </>
  );
}

export default App;
