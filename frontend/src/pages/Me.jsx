import { Link } from "react-router-dom";
import { HiChevronRight } from "react-icons/hi";
import usePageMeta from "../hooks/usePageMeta";

// Account, settings and the links nothing else needs to show
function Me({ user, theme, onToggleTheme, onLogout }) {
  usePageMeta("Me");
  return (
    <>
      <header className="screen-head">
        <h1>{user.name}</h1>
      </header>
      <p className="note">{user.email}</p>

      <ul className="menu">
        {user.role === "admin" && (
          <li><Link to="/admin">Admin console <HiChevronRight aria-hidden /></Link></li>
        )}
        <li>
          <button onClick={onToggleTheme}>
            Dark mode <span className={`switch ${theme === "dark" ? "is-on" : ""}`} aria-hidden />
          </button>
        </li>
        <li><a href="https://www.instagram.com/beyond_the.offer" target="_blank" rel="noopener noreferrer">Instagram <HiChevronRight aria-hidden /></a></li>
        <li><Link to="/privacy">Privacy <HiChevronRight aria-hidden /></Link></li>
        <li><Link to="/terms">Terms <HiChevronRight aria-hidden /></Link></li>
        <li><Link to="/data-deletion">Delete my data <HiChevronRight aria-hidden /></Link></li>
        <li><button className="danger" onClick={onLogout}>Log out</button></li>
      </ul>
    </>
  );
}

export default Me;
