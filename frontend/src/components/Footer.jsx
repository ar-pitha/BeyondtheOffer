import { FaInstagram } from "react-icons/fa";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p>
          © {new Date().getFullYear()} <span>BeyondTheOffer</span>. All rights reserved.
        </p>
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
