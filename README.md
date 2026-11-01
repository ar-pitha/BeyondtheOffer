# BeyondTheOffer

A full-stack MERN application to discover jobs and quizzes from platforms like Unstop, Naukri, LinkedIn, HackerRank, and more — all in one place.

## Features

- **User Authentication** — Register & login with JWT-based auth
- **Admin Panel** — Create, edit, and delete job and quiz postings
- **User Panel** — Browse all jobs and quizzes with external apply/participate links
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Dark Theme** — Modern glassmorphism UI with gradient accents

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React 18, Vite, React Router      |
| Backend  | Node.js, Express.js               |
| Database | MongoDB (Mongoose ODM)            |
| Auth     | JWT + bcryptjs                    |
| Styling  | Vanilla CSS (custom design system)|

## Project Structure

```
beyondtheoffer/
├── frontend/          # React + Vite
│   ├── src/
│   │   ├── components/  # Navbar, Footer, Cards, Modal, etc.
│   │   ├── pages/       # Home, Login, Register, Jobs, Quizzes, Admin pages
│   │   ├── App.jsx      # Routes & auth state
│   │   ├── main.jsx     # Entry point
│   │   └── index.css    # Design system
│   ├── .env
│   └── vite.config.js
│
├── backend/           # Express API
│   ├── controllers/   # Auth, Job, Quiz controllers
│   ├── models/        # Mongoose schemas
│   ├── routes/        # API route definitions
│   ├── server.js      # Express + MongoDB setup
│   ├── seed.js        # Admin seeding script
│   └── .env
│
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB Atlas account (or local MongoDB)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/beyondtheoffer.git
cd beyondtheoffer
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create a `.env` file (or edit the existing one):

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/beyondtheoffer
JWT_SECRET=your_secret_key
PORT=5000
```

Seed the admin user:

```bash
npm run seed
```

Start the backend:

```bash
npm run dev
```

### 3. Setup Frontend

```bash
cd frontend
npm install
```

Create a `.env` file (or edit the existing one):

```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

The app will be running at `http://localhost:3000`.

### Default Admin Credentials

| Email                      | Password  |
|----------------------------|-----------|
| admin@beyondtheoffer.com   | admin123  |

> ⚠️ Change the admin password after first login.

## Deployment

### Frontend → Vercel

1. Push code to GitHub
2. Import the `frontend/` folder in [Vercel](https://vercel.com)
3. Set environment variable: `VITE_API_URL=https://your-backend-url.onrender.com/api`
4. Deploy

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Point it to the `backend/` folder
3. Set environment variables: `MONGO_URI`, `JWT_SECRET`, `PORT`
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Deploy

### Database → MongoDB Atlas

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a database user and whitelist your IP (or allow all with `0.0.0.0/0`)
3. Copy the connection string and use it as `MONGO_URI`

## Automation (daily feed + Instagram)

The full setup guide (accounts, keys, sheet layout, deploy, daily routine) is in [READMEINSTA.md](READMEINSTA.md). This section lists what is built and the details that guide doesn't cover.

### What runs where

| Piece | File | Runs on |
|---|---|---|
| Sheet → MongoDB sync | `automation/sync.js` | GitHub Actions `sync.yml` (7:30 AM IST, then every 6 h) |
| Instagram publisher (carousel, story, reel) | `automation/publish.js` | GitHub Actions `publish.yml` (every 30 min, posts only in slots) |
| Reel builder | `automation/reels.js` | Called by the publisher (Playwright + ffmpeg) |
| Daily insights | `automation/insights.js` | Run by `sync.yml` at the 02:00 UTC run |
| Comment replies + "Comment JOB" DMs | `frontend/api/instagram-webhook.js` | Vercel function in the frontend project |
| News API | `GET /api/news` | Existing backend |

Shared code for Google Sheets, Instagram and the reply rules lives in `frontend/api/_lib/`, because Vercel only bundles files inside the frontend project. `automation/lib/` re-exports it, so the webhook and the scripts follow the same rules. There are no extra npm dependencies: Google auth, Cloudinary and Instagram all use built-in `crypto` and `fetch`.

### Try it locally without any keys

```bash
cd backend && npm install            # sync reuses the backend's Mongoose models
cd ../automation && npm install && npx playwright install chromium
npm run publish:sample               # renders fixtures/content-queue.sample.json → automation/renders/
npm run reel:sample                  # needs ffmpeg on PATH (or set FFMPEG_PATH)
```

### Extra settings beyond READMEINSTA.md

| Name | Where | What it does |
|---|---|---|
| `AUTOMATION_USER_EMAIL` | automation `.env`, GitHub secret | Admin account that synced items are attributed to (`postedBy` is required). Defaults to the first admin. |
| `IG_TOKEN_ISSUED_AT` | automation `.env`, GitHub secret | `YYYY-MM-DD` when the long-lived token was made. After 50 days the publisher warns. Run `node lib/instagram.js refresh` locally to get a new token; the new token is never printed in CI logs. |
| `DRY_RUN` | GitHub **variable** (not secret) | Scheduled publish runs stay dry until you set it to `false`. Manual runs use the checkbox instead. |
| `POST_SLOTS_IST`, `WEBSITE_URL` | GitHub variables | Optional overrides. |
| `WEBSITE_URL`, `AI_REPLY_MODE`, `ANTHROPIC_MODEL` | Vercel env | `AI_REPLY_MODE=draft` logs AI answers to `Comments_Log` instead of posting them. |

### Script flags

- `sync.js --dry-run --include-single --verbose`
- `publish.js --dry-run` (render + upload, ignores time slots), `--now` (ignore slots), `--id CQ-12`, `--sample [--format carousel|story|reel]`, `--check`
- `Format` in Content_Queue can be `Carousel`, `Story` or `Reel`. Reel scripts use `HOOK:`, `POINT:`, `CTA:` lines. Slides can force a layout with `Slide 3 (cta): ...`.
- Item slides turn a field starting with `Apply by`, `Last date` or `Register by` into the deadline stub, and one starting with `Verified` into the green tag.

### How the site treats synced items

- Only `Status=Active` rows with `Verified` set to Official or Multi-source are synced. Rows are never deleted. Expired rows and passed deadlines get `isActive=false`, and the public lists hide them.
- Admin pages request `?includeInactive=true` so they still see hidden items. Synced items show an **Auto** tag, and hidden ones a **Hidden** tag.
- Editing an item in the admin panel sets `adminEdited=true`, and the sync never touches it again.
- The backend is deployed on Vercel (`backend/vercel.json`), not Render. Nothing in the automation depends on which one you use.

## License

MIT
