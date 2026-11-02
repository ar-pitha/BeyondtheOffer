import { useEffect, useState } from "react";
import { Outlet, Link, NavLink } from "react-router-dom";
import {
  HiOutlineHome, HiHome,
  HiOutlineNewspaper, HiNewspaper,
  HiOutlineBookmark, HiBookmark,
  HiOutlineUserCircle, HiUserCircle,
  HiOutlineChartBar, HiChartBar,
  HiOutlineBriefcase, HiBriefcase,
  HiOutlineLightningBolt, HiLightningBolt,
} from "react-icons/hi";
import { FaInstagram } from "react-icons/fa";
import { trackSiteView } from "../utils/siteViews";

const Brand = ({ to = "/" }) => (
  <Link to={to} className="brand">
    <img src="/image.png" alt="" />
    BeyondTheOffer
  </Link>
);

// Visitors: landing, legal pages, post links
export function PublicLayout({ user }) {
  const [views, setViews] = useState(null);

  useEffect(() => {
    trackSiteView().then((total) => {
      if (typeof total === "number") setViews(total);
    });
  }, []);

  return (
    <div className="public">
      <header className="public-head">
        <Brand />
        <nav className="public-actions">
          {user ? (
            <Link to={user.role === "admin" ? "/admin" : "/"} className="btn btn-dark btn-sm">Open app</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary btn-sm">Log in</Link>
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
        <span className="public-foot-views">
          Site visits: {views === null ? "000000" : String(views).padStart(6, "0")}
        </span>
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

const Tabs = ({ items, className = "tabbar", label = "Main" }) => (
  <nav className={className} aria-label={label}>
    {items.map(({ to, label: text, icon: Icon, active: Active, end }) => (
      <NavLink key={to} to={to} end={end} className="tab">
        {({ isActive }) => (
          <>
            {isActive ? <Active aria-hidden /> : <Icon aria-hidden />}
            <span>{text}</span>
          </>
        )}
      </NavLink>
    ))}
  </nav>
);

// Students: bottom nav on phones, top bar on desktop (same four tabs)
export function AppLayout() {
  return (
    <div className="app">
      <header className="app-top">
        <Brand />
        <Tabs items={TABS} className="top-tabs" />
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <Tabs items={TABS} />
    </div>
  );
}

const ADMIN_NAV = [
  { to: "/admin", label: "Overview", icon: HiOutlineChartBar, active: HiChartBar, end: true },
  { to: "/admin/feed", label: "Instagram", icon: FaInstagram, active: FaInstagram },
  { to: "/admin/jobs", label: "Jobs", icon: HiOutlineBriefcase, active: HiBriefcase },
  { to: "/admin/quizzes", label: "Events", icon: HiOutlineLightningBolt, active: HiLightningBolt },
];

// Admin console: dark bar with sections on desktop; slim bar + bottom tabs on phones
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
      {/* Phones: the same bottom tabs as the student app */}
      <Tabs items={ADMIN_NAV} className="tabbar admin-tabbar" label="Admin" />
    </div>
  );
}
