import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { HiBriefcase, HiLightningBolt, HiGlobe, HiUsers } from "react-icons/hi";
import axios from "axios";

function RevealOnScroll({ children, delay = "0s", className = "" }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={ref} 
      className={className} 
      style={{ 
        opacity: isVisible ? 1 : 0,
        animation: isVisible ? `slideUp 0.6s ease ${delay} forwards` : 'none'
      }}
    >
      {children}
    </div>
  );
}

function Home() {
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const { data } = await axios.get("/api/auth/users/count");
        setUserCount(data.count);
      } catch (error) {
        console.error("Failed to fetch user count", error);
      }
    };
    fetchUserCount();
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <h1 style={{ animation: "slideUp 0.6s ease forwards" }}>
          Go <span>Beyond</span> The Offer
        </h1>
        <p style={{ animation: "slideUp 0.6s ease 0.2s forwards", opacity: 0 }}>
          Discover top jobs and quizzes from platforms like Unstop, Naukri, LinkedIn,
          HackerRank, and more — all in one place.
        </p>
        <div className="hero-buttons" style={{ animation: "fadeIn 0.6s ease 0.4s forwards", opacity: 0 }}>
          <Link to="/jobs" className="btn btn-primary">
            Browse Jobs
          </Link>
          <Link to="/quizzes" className="btn btn-secondary">
            Explore Quizzes
          </Link>
        </div>
        
        {userCount > 0 && (
          <div 
            className="trusted-badge" 
            style={{ 
              animation: "slideUp 0.8s ease 0.6s forwards", 
              opacity: 0, 
              marginTop: "2.5rem", 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "0.5rem", 
              background: "var(--bg-card)", 
              padding: "0.5rem 1.25rem", 
              borderRadius: "2rem", 
              boxShadow: "var(--shadow-md)", 
              border: "1px solid var(--border-color)", 
              color: "var(--text-secondary)", 
              fontSize: "0.875rem", 
              fontWeight: 500 
            }}
          >
            <HiUsers style={{ color: "var(--text-primary)", fontSize: "1.25rem" }} />
            Trusted by <strong style={{ color: "var(--text-primary)" }}>{userCount}+</strong> people
          </div>
        )}
      </section>

      {/* About Section */}
      <section className="about-section container">
        <RevealOnScroll>
          <div className="about-card">
            <h2>About BeyondTheOffer</h2>
            <p>
              BeyondTheOffer is a free platform built to help students and freshers
              discover the best job openings and quiz competitions — all in one place.
              No more hopping between Unstop, LinkedIn, Naukri, and HackerRank. We
              curate the best opportunities and bring them straight to you.
            </p>
            <p>
              Whether you're looking for your first job or want to sharpen your skills
              through competitive quizzes, BeyondTheOffer has you covered.
            </p>
          </div>
        </RevealOnScroll>
      </section>

      {/* Features Section */}
      <section className="features container">
        <div className="features-grid">
          <RevealOnScroll className="feature-card" delay="0.1s">
            <div className="feature-icon">
              <HiBriefcase />
            </div>
            <h3>Curated Jobs</h3>
            <p>
              Handpicked job postings from Naukri, LinkedIn, Unstop, and other
              leading platforms.
            </p>
          </RevealOnScroll>

          <RevealOnScroll className="feature-card" delay="0.3s">
            <div className="feature-icon">
              <HiLightningBolt />
            </div>
            <h3>Live Quizzes</h3>
            <p>
              Participate in quizzes and challenges from Unstop, HackerRank,
              and other contest platforms.
            </p>
          </RevealOnScroll>

          <RevealOnScroll className="feature-card" delay="0.5s">
            <div className="feature-icon">
              <HiGlobe />
            </div>
            <h3>One Platform</h3>
            <p>
              No more switching between tabs. Find everything you need in a
              single, clean dashboard.
            </p>
          </RevealOnScroll>
        </div>
      </section>
    </>
  );
}

export default Home;
