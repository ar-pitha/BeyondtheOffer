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

## License

MIT
