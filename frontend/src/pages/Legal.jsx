import { Link } from "react-router-dom";
import usePageMeta from "../hooks/usePageMeta";

const CONTACT = "kadaripavani1@gmail.com";
const UPDATED = "1 November 2026";
const Mail = ({ subject }) => (
  <a href={`mailto:${CONTACT}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`}>{CONTACT}</a>
);

export function Privacy() {
  usePageMeta("Privacy policy", "How BeyondTheOffer and @beyond_the.offer collect, use and delete your data.");
  return (
    <article className="page container legal">
      <header className="page-header">
        <h1>Privacy policy</h1>
        <p>Last updated {UPDATED}</p>
      </header>

      <p>
        BeyondTheOffer (the website at beyondtheoffer.vercel.app and the Instagram account{" "}
        <a href="https://www.instagram.com/beyond_the.offer" target="_blank" rel="noopener noreferrer">@beyond_the.offer</a>)
        shares jobs, government notifications and hackathons for students and freshers. This page explains what
        data we collect, why, and how to have it deleted.
      </p>

      <h2>Data we collect on the website</h2>
      <ul>
        <li><b>Account details:</b> your name, email address and a hashed password (we never store the password itself). If you sign in with Google, we receive your name and email from Google.</li>
        <li><b>In your browser:</b> a login token and your light/dark theme choice are saved in your browser's local storage so you stay signed in. We use no advertising or analytics cookies.</li>
      </ul>

      <h2>Data we process on Instagram</h2>
      <p>Our Instagram automation uses Meta's official Instagram API. When you comment on one of our posts or message us:</p>
      <ul>
        <li>We read the comment or message text, its ID, the post it belongs to and your Instagram username.</li>
        <li>If your comment asks for links (for example "JOB"), we reply publicly and send you a private message with the apply links from that post.</li>
        <li>If you thank us or ask a question, we may reply to your comment. Questions may be answered with the help of an AI model, which receives only your comment text and our post caption.</li>
        <li>We keep a log of each comment and our reply (time, comment ID, post ID, username, text, action taken) so we never reply twice and can review replies.</li>
        <li>We read aggregate statistics for our own posts (reach, likes, saves, followers). This does not identify you.</li>
      </ul>
      <p>We do not sell your data, use it for advertising, or message you about anything other than what you asked for.</p>

      <h2>Where the data is stored</h2>
      <ul>
        <li>Website accounts: MongoDB Atlas database.</li>
        <li>Comment logs and our content plan: a private Google Sheet.</li>
        <li>Post images: Cloudinary. The website and API run on Vercel.</li>
      </ul>
      <p>These providers process the data only to run the service for us.</p>

      <h2>How long we keep it</h2>
      <p>
        Account details stay until you ask us to delete your account. Comment logs are kept for up to 12 months and then
        deleted. Removing a comment on Instagram does not automatically remove our log entry; ask us and we will.
      </p>

      <h2>Your choices and deletion</h2>
      <p>
        You can ask us to see, correct or delete your data at any time. See <Link to="/data-deletion">how to delete your data</Link>,
        or email <Mail subject="BeyondTheOffer data request" />. We respond within 30 days.
      </p>

      <h2>Children</h2>
      <p>The service is meant for students and job seekers aged 16 and over.</p>

      <h2>Changes</h2>
      <p>If we change this policy we will update the date at the top of this page.</p>

      <h2>Contact</h2>
      <p>Questions about privacy: <Mail subject="BeyondTheOffer privacy" />.</p>
    </article>
  );
}

export function DataDeletion() {
  usePageMeta("Delete your data", "How to delete your BeyondTheOffer account and any Instagram data we hold about you.");
  return (
    <article className="page container legal">
      <header className="page-header">
        <h1>Delete your data</h1>
        <p>Last updated {UPDATED}</p>
      </header>

      <h2>Website account</h2>
      <ol>
        <li>Email <Mail subject="Delete my BeyondTheOffer account" /> from the address you signed up with, with the subject "Delete my BeyondTheOffer account".</li>
        <li>We delete your name, email and password hash within 30 days and reply to confirm.</li>
      </ol>

      <h2>Instagram comments and messages</h2>
      <ol>
        <li>Send a direct message to <a href="https://www.instagram.com/beyond_the.offer" target="_blank" rel="noopener noreferrer">@beyond_the.offer</a> saying "DELETE MY DATA", or email <Mail subject="Delete my Instagram data" /> with your Instagram username.</li>
        <li>We delete every comment log entry linked to your username within 30 days and confirm by reply.</li>
      </ol>

      <h2>Removing our app's access</h2>
      <p>
        If you connected an Instagram or Facebook account to our app, you can remove it any time in Instagram under
        Settings → Website permissions → Apps and websites, or in Facebook under Settings → Business integrations.
      </p>

      <p>See our <Link to="/privacy">privacy policy</Link> for what we collect.</p>
    </article>
  );
}

export function Terms() {
  usePageMeta("Terms of use", "Terms for using the BeyondTheOffer website and @beyond_the.offer Instagram account.");
  return (
    <article className="page container legal">
      <header className="page-header">
        <h1>Terms of use</h1>
        <p>Last updated {UPDATED}</p>
      </header>

      <h2>What we provide</h2>
      <p>
        BeyondTheOffer lists job openings, government notifications, hackathons and tech news gathered from public
        sources. Each listing links to the original source, which is where you apply.
      </p>

      <h2>Check before you apply</h2>
      <p>
        We check listings against official sources, but details can change after we publish them. Always confirm
        dates, eligibility and fees on the official page. We never ask for money to apply, and we are not the employer
        or exam body for any listing.
      </p>

      <h2>Your account</h2>
      <p>Keep your login private. Don't use the site to spam, scrape it in bulk, or post misleading information. We may close accounts that do.</p>

      <h2>Liability</h2>
      <p>The service is free and provided as is. We are not responsible for decisions made by employers, exam bodies or event organisers.</p>

      <h2>Privacy</h2>
      <p>See our <Link to="/privacy">privacy policy</Link> and how to <Link to="/data-deletion">delete your data</Link>.</p>

      <h2>Contact</h2>
      <p><Mail subject="BeyondTheOffer terms" /></p>
    </article>
  );
}
