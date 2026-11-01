import { Outlet, Link, NavLink } from "react-router-dom";
import {
  HiOutlineHome, HiHome,
  HiOutlineNewspaper, HiNewspaper,
  HiOutlineBookmark, HiBookmark,
  HiOutlineUserCircle, HiUserCircle,
} from "react-icons/hi";

const Brand = ({ to = "/" }) => (
  <Link to={to} className="brand">
    <img src="/image.png" alt="" />
    BeyondTheOffer
  </Link>
);

// Visitors: landing, legal pages, post links
export function PublicLayout({ user }) {
  return (
    <div className="public">
      <header className="public-head">
        <Brand />
        <nav className="public-actions">
          {user ? (
            <Link to={user.role === "admin" ? "/admin" : "/"} className="btn btn-dark btn-sm">Open app</Link>
          ) : (
            <>
              <Link to="/login" className="text-link">Log in</Link>
              <Link to="/register" className="btn btn-dark btn-sm">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="public-foot">
        <span>© {new Date().getFullYear()} BeyondTheOffer</span>
        <a href="https://www.instagram.com/beyond_the.offer" target="_blank" rel="noopener noreferrer">Instagram</a>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </footer>
    </div>
  );
}

// Log in / sign up: only the form
export function AuthLayout() {
  return (
    <div className="auth">
      <Brand />
      <Outlet />
    </div>
  );
}

const TABS = [
  { to: "/", label: "Feed", icon: HiOutlineHome, active: HiHome, end: true },
  { to: "/news", label: "News", icon: HiOutlineNewspaper, active: HiNewspaper },
  { to: "/saved", label: "Saved", icon: HiOutlineBookmark, active: HiBookmark },
  { to: "/me", label: "Me", icon: HiOutlineUserCircle, active: HiUserCircle },
];

// Students: content + bottom nav
export function AppLayout() {
  return (
    <div className="app">
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ to, label, icon: Icon, active: Active, end }) => (
          <NavLink key={to} to={to} end={end} className="tab">
            {({ isActive }) => (
              <>
                {isActive ? <Active aria-hidden /> : <Icon aria-hidden />}
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

const ADMIN_NAV = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/feed", label: "Instagram" },
  { to: "/admin/jobs", label: "Jobs" },
  { to: "/admin/quizzes", label: "Events" },
];

// Admin console: its own dark bar and sections, no student navigation
export function AdminLayout({ user, onLogout }) {
  return (
    <div className="admin">
      <header className="admin-bar">
        <div className="admin-bar-top">
          <Link to="/admin" className="admin-brand">
            BeyondTheOffer <span>Admin</span>
          </Link>
          <div className="admin-bar-actions">
            <Link to="/" className="admin-bar-link">View site</Link>
            <button className="admin-bar-link" onClick={onLogout} title={user?.email}>Log out</button>
          </div>
        </div>
        <nav className="admin-nav" aria-label="Admin">
          {ADMIN_NAV.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}>{label}</NavLink>
          ))}
        </nav>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
