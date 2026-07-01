import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HiMenu, HiX, HiSun, HiMoon, HiLogout } from "react-icons/hi";

function Navbar({ user, onLogout, theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? "active" : "";
  const close = () => setMenuOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand" onClick={close}>
          <img src="/image.png" alt="BeyondTheOffer" />
          BeyondTheOffer
        </Link>

        <div className={`navbar-links ${menuOpen ? "open" : ""}`}>
          {!user && (
            <Link to="/" className={isActive("/")} onClick={close}>Home</Link>
          )}
          <Link to="/jobs" className={isActive("/jobs")} onClick={close}>Jobs</Link>
          <Link to="/quizzes" className={isActive("/quizzes")} onClick={close}>Quizzes</Link>

          {user?.role === "admin" && (
            <Link to="/admin" className={isActive("/admin")} onClick={close}>Admin</Link>
          )}

          {!user && (
            <Link to="/register" onClick={close}>
              <span className="btn btn-primary btn-sm">Sign Up</span>
            </Link>
          )}

          {/* Logout lives inside the dropdown on mobile; hidden on desktop */}
          {user && (
            <button
              className="nav-logout-text"
              onClick={() => { onLogout(); close(); }}
              aria-label="Logout"
            >
              <HiLogout /> Logout
            </button>
          )}
        </div>

        <div className="navbar-right">
          {/* Desktop-only logout icon — hidden on mobile via .nav-logout-icon */}
          {user && (
            <button
              className="theme-toggle logout-btn nav-logout-icon"
              onClick={onLogout}
              aria-label="Logout"
              title="Logout"
            >
              <HiLogout />
            </button>
          )}
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? <HiMoon /> : <HiSun />}
          </button>
          <button
            className="mobile-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <HiX /> : <HiMenu />}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
