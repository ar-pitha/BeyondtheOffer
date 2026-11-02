import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import axios from "axios";

import { PublicLayout, AuthLayout, AppLayout, AdminLayout } from "./components/Layouts";
import ProtectedRoute from "./components/ProtectedRoute";
import { trackSiteView } from "./utils/siteViews";

import Landing from "./pages/Landing";
import Feed from "./pages/Feed";
import News from "./pages/News";
import Saved from "./pages/Saved";
import Me from "./pages/Me";
import Links from "./pages/Links";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { Privacy, Terms, DataDeletion } from "./pages/Legal";
import AdminDashboard from "./pages/AdminDashboard";
import AdminJobs from "./pages/AdminJobs";
import AdminQuizzes from "./pages/AdminQuizzes";
import AdminFeed from "./pages/AdminFeed";

// Same-origin /api: Vercel forwards it to the backend (frontend/vercel.json), and the
// Vite dev server proxies it to localhost:5000. Browsers never call the backend domain
// directly, which some Indian networks fail to reach.
axios.defaults.baseURL = "";

const homeFor = (user) => (user?.role === "admin" ? "/admin" : "/");

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Every page load/refresh counts one visit. SPA navigation does not.
  useEffect(() => {
    trackSiteView();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      axios.defaults.headers.common["Authorization"] = `Bearer ${parsed.token}`;
    }
    setLoading(false);
  }, []);

  const loginUser = (userData, rememberMe) => {
    setUser(userData);
    (rememberMe ? localStorage : sessionStorage).setItem("user", JSON.stringify(userData));
    axios.defaults.headers.common["Authorization"] = `Bearer ${userData.token}`;
  };

  const logoutUser = () => {
    setUser(null);
    localStorage.removeItem("user");
    sessionStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
  };

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  if (loading) return null;

  const shell = { user, theme, onToggleTheme: toggleTheme, onLogout: logoutUser };

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: theme === "dark" ? "#1c1c1f" : "#111114",
            color: "#ffffff",
            fontFamily: "var(--font)",
            fontSize: "14px",
            borderRadius: "10px",
          },
        }}
      />
      <Routes>
        {/* Visitors: landing page, legal pages, post links */}
        <Route element={<PublicLayout {...shell} />}>
          {!user && <Route path="/" element={<Landing />} />}
          {!user && <Route path="/news" element={<News />} />}
          <Route path="/links/:id" element={<Links />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
        </Route>

        {/* Sign in / sign up: nothing else on screen */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={user ? <Navigate to={homeFor(user)} replace /> : <Login onLogin={loginUser} />} />
          <Route path="/register" element={user ? <Navigate to={homeFor(user)} replace /> : <Register onLogin={loginUser} />} />
        </Route>

        {/* Students: the app with the bottom nav */}
        {user && (
          <Route element={<AppLayout {...shell} />}>
            <Route path="/" element={<Feed />} />
            <Route path="/news" element={<News />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/me" element={<Me {...shell} />} />
          </Route>
        )}

        {/* Admin console */}
        <Route element={<ProtectedRoute user={user} adminOnly><AdminLayout {...shell} /></ProtectedRoute>}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/feed" element={<AdminFeed />} />
          <Route path="/admin/jobs" element={<AdminJobs />} />
          <Route path="/admin/quizzes" element={<AdminQuizzes />} />
        </Route>

        {/* Old links keep working */}
        <Route path="/jobs" element={<Navigate to={user ? "/" : "/login"} replace />} />
        <Route path="/quizzes" element={<Navigate to={user ? "/?kind=events" : "/login"} replace />} />
        {!user && <Route path="/saved" element={<Navigate to="/login" replace />} />}
        {!user && <Route path="/me" element={<Navigate to="/login" replace />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
