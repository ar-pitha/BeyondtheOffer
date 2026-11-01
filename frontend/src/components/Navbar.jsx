import { NavLink, Link } from "react-router-dom";
import {
  HiOutlineHome, HiHome,
  HiOutlineBriefcase, HiBriefcase,
  HiOutlineLightningBolt, HiLightningBolt,
  HiOutlineNewspaper, HiNewspaper,
  HiOutlineBookmark, HiBookmark,
  HiOutlineViewGrid, HiViewGrid,
  HiOutlineUserCircle, HiUserCircle,
  HiSun, HiMoon, HiLogout,
} from "react-icons/hi";
import { FaInstagram } from "react-icons/fa";

// Sidebar on desktop; top bar + bottom tab bar on phones (one component, CSS decides).
function Navbar({ user, onLogout, theme, onToggleTheme }) {
  const items = [
    { to: "/", label: "Home", icon: HiOutlineHome, active: HiHome, end: true },
    { to: "/jobs", label: "Jobs", icon: HiOutlineBriefcase, active: HiBriefcase },
    { to: "/quizzes", label: "Hackathons", icon: HiOutlineLightningBolt, active: HiLightningBolt },
    { to: "/news", label: "News", icon: HiOutlineNewspaper, active: HiNewspaper },
  ];
  if (user) items.push({ to: "/saved", label: "Saved", icon: HiOutlineBookmark, active: HiBookmark });
  if (user?.role === "admin") items.push({ to: "/admin", label: "Admin", icon: HiOutlineViewGrid, active: HiViewGrid });

  // The phone tab bar has room for five
  const tabs = [
    ...items.slice(0, 4),
    user?.role === "admin"
      ? items.find((i) => i.to === "/admin")
      : user
        ? items.find((i) => i.to === "/saved")
        : { to: "/login", label: "Log in", icon: HiOutlineUserCircle, active: HiUserCircle },
  ];

  const ThemeIcon = theme === "light" ? HiMoon : HiSun;
  const themeLabel = theme === "light" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar" aria-label="Main">
        <Link to="/" className="brand">
          <img src="/image.png" alt="" />
          <span>BeyondTheOffer</span>
        </Link>

        <nav className="side-nav">
          {items.map(({ to, label, icon: Icon, active: ActiveIcon, end }) => (
            <NavLink key={to} to={to} end={end} className="side-link">
              {({ isActive }) => (
                <>
                  {isActive ? <ActiveIcon aria-hidden /> : <Icon aria-hidden />}
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="side-foot">
          {user ? (
            <div className="side-user">
              <span className="side-avatar" aria-hidden>{(user.name || "?")[0].toUpperCase()}</span>
              <span className="side-user-name">{user.name}</span>
              <button className="icon-btn" onClick={onLogout} aria-label="Log out" title="Log out">
                <HiLogout />
              </button>
            </div>
          ) : (
            <div className="side-auth">
              <Link to="/register" className="btn btn-primary btn-block">Sign up free</Link>
              <Link to="/login" className="btn btn-ghost btn-block">Log in</Link>
            </div>
          )}
          <div className="side-row">
            <button className="icon-btn" onClick={onToggleTheme} aria-label={themeLabel} title={themeLabel}>
              <ThemeIcon />
            </button>
            <a className="side-insta" href="https://www.instagram.com/beyond_the.offer" target="_blank" rel="noopener noreferrer">
              <FaInstagram aria-hidden /> @beyond_the.offer
            </a>
          </div>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/image.png" alt="" />
          <span>BeyondTheOffer</span>
        </Link>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={onToggleTheme} aria-label={themeLabel}>
            <ThemeIcon />
          </button>
          {user ? (
            <button className="icon-btn" onClick={onLogout} aria-label="Log out">
              <HiLogout />
            </button>
          ) : (
            <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
          )}
        </div>
      </header>

      {/* Phone bottom tab bar */}
      <nav className="tabbar" aria-label="Main">
        {tabs.map(({ to, label, icon: Icon, active: ActiveIcon, end }) => (
          <NavLink key={to} to={to} end={end} className="tab">
            {({ isActive }) => (
              <>
                {isActive ? <ActiveIcon aria-hidden /> : <Icon aria-hidden />}
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export default Navbar;
