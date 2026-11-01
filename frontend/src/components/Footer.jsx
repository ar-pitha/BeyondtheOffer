import { Link } from "react-router-dom";
import { FaInstagram } from "react-icons/fa";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p>
          © {new Date().getFullYear()} <span>BeyondTheOffer</span>. All rights reserved.
        </p>
        <nav className="footer-links" aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/data-deletion">Delete your data</Link>
        </nav>
        <div className="footer-social">
          <a
            href="https://www.instagram.com/beyond_the.offer"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaInstagram /> @beyond_the.offer
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
