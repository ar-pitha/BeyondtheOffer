## Automation (Instagram + daily feed)

Daily jobs, government notifications, hackathons and tech news are collected into a Google Sheet. Checked rows are synced into MongoDB, so they show up on the website automatically. Approved posts are published to Instagram [@beyond_the.offer](https://www.instagram.com/beyond_the.offer), and comments get replies.

### How it fits the existing app

```
 Claude daily task (6:36 AM IST)
        │ adds rows + drafts posts
        ▼
 Google Sheet "BeyondTheOffer Feed" ◀── you approve drafts (Status = Approved)
        │                                  │
        │ GitHub Actions: sync.yml         │ GitHub Actions: publish.yml (every 30 min)
        ▼                                  ▼
 MongoDB Atlas (Job, Quiz, News)      render slides → Cloudinary → Instagram API
        │                                  │
        ▼                                  ▼
 Express API (Render) → React site    Instagram post
 (existing, unchanged flow)                │ comments
                                           ▼
                         Vercel function: frontend/api/instagram-webhook.js
                         → public reply + "Comment JOB" DM with links
```

| Part | Runs on | Notes |
|---|---|---|
| Research and drafts | Claude scheduled task | Already running daily at 6:36 AM IST |
| Sheet → MongoDB sync | GitHub Actions (`sync.yml`) | 7:30 AM IST and every 6 hours |
| Publisher | GitHub Actions (`publish.yml`) | Every 30 min; posts only in slots |
| Instagram webhook | Vercel function in `frontend/api/` | Always on (Render free tier sleeps) |
| Website + admin | Existing Vercel + Render + Atlas | Unchanged; shows synced items too |

### New folders and files

```
beyondtheoffer/
├── frontend/
│   └── api/
│       └── instagram-webhook.js     # NEW – Vercel serverless function
├── backend/
│   ├── models/                      # Job/Quiz get OPTIONAL new fields; NEW News model
│   ├── controllers/newsController.js  # NEW
│   └── routes/newsRoutes.js         # NEW
├── automation/                      # NEW – Node package (run by GitHub Actions)
│   ├── lib/
│   │   ├── sheets.js                # Google Sheets read/write
│   │   ├── mongo.js                 # connects with MONGO_URI, reuses backend models
│   │   ├── instagram.js             # containers, publish, comments, DMs, token refresh
│   │   ├── cloudinary.js            # public JPEG URLs for Instagram
│   │   ├── render.js                # HTML → 1080x1350 JPEG (Playwright)
│   │   └── replies.js               # comment rules (shared with the webhook)
│   ├── templates/reel.html          # reels, story videos and carousel slides
│   ├── templates/brand.json
│   ├── sync.js                      # Sheet → MongoDB
│   ├── publish.js                   # Approved drafts → Instagram
│   ├── insights.js                  # Phase 5
│   ├── reels.js                     # Phase 5
│   ├── package.json
│   └── .env.example
└── .github/workflows/
    ├── sync.yml
    └── publish.yml
```

### Phase 0: Accounts and keys

**Meta app (Instagram API with Instagram Login, no Facebook Page needed)**
1. developers.facebook.com → **Create App** → type **Business**.
2. Add the **Instagram** product → **API setup with Instagram login** → add `@beyond_the.offer` → generate a token.
3. Permissions:

| Permission | Used for |
|---|---|
| `instagram_business_basic` | Profile and media |
| `instagram_business_content_publish` | Posting carousels, reels, stories |
| `instagram_business_manage_comments` | Reading and replying to comments |
| `instagram_business_manage_messages` | "Comment JOB" DMs |
| `instagram_business_manage_insights` | Reach, saves, followers |

4. Development mode is fine for your own account.
5. Exchange the token for a **long-lived token** (60 days).
6. Save the **App ID, App Secret, IG User ID and token**.
7. After deploying the frontend, set the webhook URL to `https://beyondtheoffer.vercel.app/api/instagram-webhook`, choose a verify token, and subscribe to the **comments** and **messages** fields.

**Google service account (Sheets access)**
1. console.cloud.google.com → new project → enable the **Google Sheets API**.
2. **Credentials → Service account → Keys → Add key → JSON**.
3. Share the sheet **BeyondTheOffer Feed** with the service account email as **Editor**.
4. Sheet ID: `1wMs0w53J7STUPeFuP7mlE-QTKLG9UP97_JXJl-BtGdI`

**Cloudinary (free)**
- Copy the cloud name, API key and API secret. Instagram only accepts images from public JPEG URLs, which Cloudinary provides.

### Local setup (VS Code)

```bash
# existing app (unchanged)
cd backend  && npm install && npm run dev      # http://localhost:5000
cd frontend && npm install && npm run dev      # http://localhost:3000

# automation
cd automation
npm install
npx playwright install chromium
cp .env.example .env                           # fill values (see below)
mkdir secrets                                  # put google-sa.json here (git-ignored)
node sync.js --dry-run                         # shows what would be written to MongoDB
node publish.js --dry-run                      # renders slides to automation/renders/

# webhook testing
npm i -g vercel
cd frontend && vercel dev                      # runs /api/instagram-webhook locally
ngrok http 3000                                # temporary public URL for Meta webhook setup
```

### Environment variables

`automation/.env` (and GitHub Actions secrets):

```env
MONGO_URI=                       # same Atlas URI as the backend
SHEET_ID=1wMs0w53J7STUPeFuP7mlE-QTKLG9UP97_JXJl-BtGdI
GOOGLE_SA_JSON_PATH=./secrets/google-sa.json   # local only
GOOGLE_SA_JSON_B64=                            # GitHub/Vercel: base64 of the JSON

IG_USER_ID=
IG_ACCESS_TOKEN=
IG_APP_ID=
IG_APP_SECRET=
IG_LOGIN_TYPE=unified
IG_API_BASE=https://graph.facebook.com
IG_API_VERSION=v26.0

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

TIMEZONE=Asia/Kolkata
POST_SLOTS_IST=19:00
CONTENT_ROTATION_IST=tech,news,govt,events,ai
DRY_RUN=true
WEBSITE_URL=https://beyondtheoffer.vercel.app
```

Vercel **frontend** project → Settings → Environment Variables (server-side only, so **no** `VITE_` prefix):

```env
IG_WEBHOOK_VERIFY_TOKEN=
IG_APP_SECRET=
IG_ACCESS_TOKEN=
IG_USER_ID=
SHEET_ID=1wMs0w53J7STUPeFuP7mlE-QTKLG9UP97_JXJl-BtGdI
GOOGLE_SA_JSON_B64=
ANTHROPIC_API_KEY=               # optional, for AI-written replies
```

> Anything starting with `VITE_` is bundled into the browser code. Never put secrets in `VITE_` variables.

For Unified Login, private replies use the Instagram-only messaging endpoint:

```text
POST https://graph.facebook.com/v26.0/{IG_USER_ID}/messages
Authorization: Bearer {IG_PAGE_ACCESS_TOKEN}
{
  "recipient": { "comment_id": "{COMMENT_ID}" },
  "message": { "text": "..." }
}
```

Use the comment ID from `entry[].changes[].value.id`. The Unified Login
Business Integration System User token must include `instagram_basic`,
`instagram_manage_comments`, and `instagram_manage_messages`.

Make the base64 value with:

```bash
base64 -w0 secrets/google-sa.json                                            # macOS/Linux
[Convert]::ToBase64String([IO.File]::ReadAllBytes("secrets\google-sa.json"))  # PowerShell
```

Add to `.gitignore`: `automation/.env`, `automation/secrets/`, `automation/renders/`, `**/.env`.

### Google Sheet reference

Don't rename tabs or reorder columns; the daily Claude task depends on them. Add new columns only at the end.

| Tab | Columns |
|---|---|
| `Tech_Jobs` | ID, Date_Added, Company, Role, Job_Type, Category, Eligibility_Batch, Location, Salary_Stipend, Apply_By, Apply_Link, Source, Verified, Status, Posted_On_IG, Notes |
| `Govt_Jobs` | ID, Date_Added, Organisation, Post_Exam, Sector, Vacancies, Qualification, Age_Limit, Application_Start, Last_Date, Official_Link, Notification_Link, Source, Verified, Status, Posted_On_IG, Notes |
| `Hackathons_Quizzes` | ID, Date_Added, Name, Organiser, Type, Eligibility, Prizes_Perks, Register_By, Event_Date, Link, Verified, Status, Posted_On_IG |
| `Tech_News` | ID, Date, Headline, Summary, Why_It_Matters_For_Students, Topic, Source, Link, Used_In_Post |
| `Content_Queue` | ID, Date, Format, Title, Slides_or_Script, Caption, Hashtags, Item_IDs, Design_Link, Status, Scheduled_Time_IST, IG_Post_Link |
| `Run_Log` | Run_Date, Run_Time_IST, Tech_Added, Govt_Added, Hackathons_Added, News_Added, Marked_Expired, Notes |

- `Verified`: `Official`, `Multi-source` or `Single-source`
- `Status`: `Active` or `Expired` on data tabs; `Draft` → `Approved` → `Published` (or `Rejected`) on Content_Queue
- Unscheduled posts prefer `CONTENT_ROTATION_IST` (one focused category per day: `tech`, `news`, `govt`, `events`, `ai`) and reels over carousels over stories; when no row for today's category is approved, the next approved row posts anyway so a slot is never left empty. `POST_SLOTS_IST` defaults to `13:00,19:00`. Use `Format=Reel` with `HOOK:`, `POINT:` and `CTA:` lines for the daily professional Reel; do not combine unrelated categories.
- Captions: `publish.js` keeps at most 5 hashtags (Instagram's limit since Dec 2025; the row's own tags first, `#beyondtheoffer` dropped), strips hashtags from the caption body, adds one category search phrase ("jobs for freshers", "government jobs", …) before the closing ask when the caption has none, and no longer adds a links URL (captions aren't clickable; the comment keyword DMs `/links/<ID>`).
- Optional `Collaborators` column on Content_Queue: up to 3 Instagram usernames (`@a, @b`) invited as collaborators on a reel or carousel. The post appears on their profile and in their followers' feeds once they accept.
- `REEL_TRIAL=manual|auto` (repo variable) publishes reels as trial reels, shown to non-followers first. `auto` shares a trial with followers when it performs well; `manual` leaves that to you in the app. Trials stay off the grid until shared.
- Insights (`insights.js`, daily at the 02:00 UTC sync) need the `instagram_business_manage_insights` permission (`instagram_manage_insights` on Facebook-login tokens). Without it every post logs `(#10) Application does not have permission` and the Insights tab only gets likes and comments.
- Growth playbook and the brief for the daily drafting task: `docs/instagram-growth.md`.
- Music-only reels: with `REEL_VOICE=off` (the default in the workflows) reels have no narration, just on-screen text over a track from `automation/assets/music/`. Tracks in `assets/music/<category>/` are used for that category first, a different track per reel (Regenerate changes it too), and `song@12.mp3` starts 12 s in. When there is no track, the reel falls back to the voiceover below, so a reel never goes out with only the synthesised bed.
- Voiceover (when `REEL_VOICE` is a voice name, or no track exists): each `HOOK`/`POINT`/`CTA` line is read aloud (free Edge neural TTS; `REEL_VOICE`, default `en-US-AvaMultilingualNeural`, or `en-IN-NeerjaExpressiveNeural` for an Indian accent) and on-screen words light up as they are spoken. Each category has its own look, so the daily one-category reel changes every day: tech jobs → `browser` (the address is typed, the page loads, the cursor clicks "Apply on official site"), govt → `notes`, hackathons/events → `terminal`, tech news → `news`, AI → `cinematic`. Every look has its own background, music mood and 2–3 rotating transitions, and every reel ends on a phone showing the @beyond_the.offer profile where the cursor taps Follow as the voice says it. Add `THEME: notes` to the script or set `REEL_THEME` to override. Carousels use the same looks as still 1080x1350 slides (slide counter, swipe hint on the cover, profile slide at the end), and stories are posted as short voiced videos built from their frames, with a hook and a Follow/Comment ending added when the draft has none. Add a `VO: …` line under a card to make the voice say something different from the screen. Scene lengths follow the voice, so `(3-18s)` timings only apply when TTS is unreachable and `REEL_ALLOW_SILENT=true`; otherwise the render fails and the next run retries.

### Your to-do list

Already done: Instagram name and bio, YouTube channel (@sankalp-beyondtheoffer) connected, YouTube client and token in `automation/.env`.

Once:
1. Copy the YouTube keys to GitHub: `node automation/set-github-secrets.cjs YT_CLIENT_ID YT_CLIENT_SECRET YT_REFRESH_TOKEN`
2. Give the Instagram token the insights permission (`instagram_business_manage_insights`, or `instagram_manage_insights` for Facebook-login tokens), then update `IG_ACCESS_TOKEN` in GitHub Secrets and Vercel. Without it the Insights tab has no reach or views.
3. Add music: put royalty-free MP3s (YouTube Audio Library, Pixabay Music, Uppbeat) in `automation/assets/music/`, or in `music/tech`, `music/govt`, `music/events`, `music/news`, `music/ai`, then commit them. Don't use copyrighted hits: Instagram mutes them and YouTube claims them.
4. In `/admin/feed`, click Regenerate on reels previewed before the YouTube change, so their Short is cut before the Instagram ending.
5. Apply for the YouTube API audit; after approval set the repo variable `YT_PRIVACY=public`. Until then make Shorts public by hand in YouTube Studio.
6. Comment → DM: turn on **Allow access to messages** in the Instagram app, and submit Meta App Review for Advanced Access (`docs/meta-app-review.md`). DMs reach the public only after approval; until then commenters get the public links reply. See "Comment → DM with a follow check".
7. Optional: repo variable `REEL_TRIAL=auto` for trial reels to non-followers. Paste the brief in `docs/instagram-growth.md` into the daily drafting task.

Every day:
- Approve or reject everything in `/admin/feed` (reject drafts with past deadlines). Target: 1 reel and 1 carousel a day, posted at 13:00 and 19:00 IST.
- Share new posts in WhatsApp/Telegram placement groups and spend 20 minutes commenting on bigger fresher pages.

Every 7 days (while the Google app is in Testing):
- `cd automation && node lib/youtube.js auth` (click the link, pick the channel), then step 1 again. A Run_Log line `youtube FAILED … invalid_grant` means it's due.

### YouTube Shorts (channel: Sankalp)

Every published reel is also uploaded as a YouTube Short (`automation/lib/youtube.js`) when `YT_CLIENT_ID`, `YT_CLIENT_SECRET` and `YT_REFRESH_TOKEN` are set. Carousels and stories are Instagram-only. The title is the row's `Title` (or an optional `YT_Title` column) plus `#Shorts`. The description is the Instagram caption without the "Comment JOB" ask, plus the clickable `/links/<ID>` URL. The Short's link is written to a `YT_Video_Link` column, which is created on first use. A YouTube failure is logged to Run_Log and never undoes the Instagram post. Dry runs print the YouTube metadata.

The Short is the reel without its Instagram ending (the profile card, "Follow", "Comment JOB"). It stops on the last opening and loops back to the hook. `preview.js` records where that ending starts in a `Video_CTA_At` column, and `publish.js` cuts there before uploading. Rows previewed before this change have no `Video_CTA_At`; click Regenerate on them, or they go to YouTube uncut. The automation only posts the tech content (jobs, govt jobs, hackathons, tech news). Anything else on the channel is uploaded by hand and never touched.

One-time setup:
1. Create the channel in YouTube Studio with the Google account that will own it.
2. Google Cloud console → new project → enable **YouTube Data API v3** → OAuth consent screen (External; under Audience → Test users add the channel's Gmail) → Credentials → OAuth client ID → **Desktop app**. Put the ID and secret in `automation/.env` as `YT_CLIENT_ID` / `YT_CLIENT_SECRET`.
3. `cd automation && node lib/youtube.js auth`: open the link, pick the channel, the refresh token is saved to `.env` for you. Then run `node lib/youtube.js channel` to check it's the right channel.
4. Optional: publish the consent screen ("In production") so the login stops expiring. If Google asks for branding verification (a `vercel.app` homepage can't be verified), remove the logo, links and authorized domains under Branding, then publish. While the app is in Testing the token expires every 7 days: run step 3 and step 5 again.
5. From the repo root: `node automation/set-github-secrets.cjs YT_CLIENT_ID YT_CLIENT_SECRET YT_REFRESH_TOKEN` copies only those three to GitHub Secrets. Run with no names, it copies everything and resets `DRY_RUN` to `true`.
6. Apply for the YouTube API audit (the "YouTube API Services – Audit and Quota Extension" form). Until it passes, API uploads are locked to **private**, so `YT_PRIVACY` defaults to `private`. After approval, set the repo variable `YT_PRIVACY=public`. In the meantime, private Shorts can be made public by hand in YouTube Studio.

Each upload uses about 1,600 of the default 10,000 daily quota units (about 6 uploads a day).

### Build phases (prompts for your coding agent)

Paste one phase at a time.

#### Phase 1: Models and Sheet → MongoDB sync

```
Repo: beyondtheoffer (MERN). frontend/ = React 18 + Vite (Vercel), backend/ = Express + Mongoose (Render), MongoDB Atlas. Admin panel creates/edits/deletes jobs and quizzes.

Goal of this phase: sync rows from a Google Sheet into MongoDB so they appear on the existing site. NON-DESTRUCTIVE: do not remove or rename existing fields, routes, pages or behavior. Only add optional fields, new files and new routes.

Step 1 — Inspect first and report before writing code:
- backend/models (Job, Quiz, User): every field, which are required, enums.
- backend/routes and controllers for jobs/quizzes: what the frontend lists and how (sorting, filters, pagination).
- Whether any .env file is tracked by git (`git ls-files | grep .env`). If yes, tell me; do not print secrets.

Step 2 — Extend models with OPTIONAL fields only:
- Job: externalId (String, unique sparse), origin ('admin' | 'auto', default 'admin'), jobKind ('tech' | 'govt'), sector, eligibility, location, salary, deadline (Date), verified ('Official' | 'Multi-source' | 'Single-source'), sourceName, isActive (Boolean, default true), extra (Mixed).
- Quiz: externalId, origin, eventType (hackathon/quiz/ctf/contest), organiser, prizes, deadline, verified, isActive.
- New model News: externalId (unique), date, headline, summary, whyItMatters, topic, sourceName, link, isActive.
- If existing required fields would block auto items, map sheet values into them (e.g. title = Role + " – " + Company). Never make an existing field optional.

Step 3 — automation/ package (Node 18+, ESM, googleapis or google-spreadsheet, mongoose, dotenv):
- lib/sheets.js: read a tab as an array of objects keyed by header; update cells by ID. Credentials from GOOGLE_SA_JSON_PATH or GOOGLE_SA_JSON_B64.
- lib/mongo.js: connect with MONGO_URI, reuse the backend Mongoose models (import from ../backend/models).
- sync.js:
  - Tech_Jobs + Govt_Jobs → Job (jobKind tech/govt); Hackathons_Quizzes → Quiz; Tech_News → News.
  - Only rows with Status=Active AND Verified in (Official, Multi-source). Flag --include-single.
  - Upsert by externalId = sheet ID. origin='auto'.
  - Rows now Expired in the sheet, or whose deadline has passed → isActive=false (never delete).
  - Never overwrite fields on a document an admin has edited: add an `adminEdited` boolean set by the existing admin update controller, and skip those documents.
  - --dry-run prints a summary (created / updated / deactivated) without writing.
- .env.example, README notes.

Step 4 — backend: GET /api/news (active, newest first, limit 30). Make the existing job/quiz list endpoints hide isActive=false items (items without the field count as active).

Run sync.js --dry-run against the real sheet, show the summary, then STOP and summarize changed and added files.
```

#### Phase 2: Website updates (non-destructive)

```
Continue beyondtheoffer. Phase 1 is done. Frontend only, plus small read-only API filters if needed. Do not remove or restyle existing pages; reuse the existing design system in index.css.

1. Jobs page: add filter tabs All · Tech · Govt (jobKind) and filters for sector, location and batch. Show a "Closes in N days" badge from deadline and a small Verified badge (Official / Multi-source). Items without the new fields render exactly as before.
2. Quizzes page: show eventType chips (Hackathon / Quiz / CTF) and the deadline badge.
3. New Tech News page (/news) with cards: headline, summary, "why it matters", source link. Add it to the Navbar without changing the other links.
4. Home page: a "Closing this week" strip (top 6 active jobs/quizzes by deadline).
5. Admin panel: show an "Auto" tag on origin='auto' items. Editing an auto item sets adminEdited=true.
6. SEO: page titles/descriptions; JobPosting JSON-LD on job cards.

STOP after it works locally and summarize.
```

#### Phase 3: Instagram publisher

```
Continue beyondtheoffer. Phases 1–2 are done. Extend automation/ only.

1. templates/carousel.html + brand.json: 1080x1350 (4:5) slides matching the site's dark glassmorphism style. Variants: cover, item, CTA. Footer "@beyond_the.offer · link in bio".
2. lib/render.js: parse Content_Queue.Slides_or_Script ("Slide N: ..." lines, fields split by "|") and render each slide with Playwright to JPEG (quality 90). Instagram accepts JPEG only. Output to automation/renders/<CQ-ID>/.
3. lib/cloudinary.js: upload to folder beyondtheoffer/<CQ-ID>/ and return secure URLs.
4. lib/instagram.js (IG_API_BASE + IG_API_VERSION):
   - createImageContainer(url, {isCarouselItem}); createCarouselContainer(childIds, caption) (max 20 items)
   - waitUntilFinished(id): poll status_code once a minute, max 5 minutes
   - publish(creationId) → media id; getPermalink(id)
   - getPublishingLimit() via /<IG_ID>/content_publishing_limit
   - refreshToken(): when the token is older than 50 days, refresh it and log a clear message to update the secret
5. publish.js:
   - pick ONE Content_Queue row: Status=Approved, Format=Carousel, Scheduled_Time_IST empty or <= now. If empty, publish only within POST_SLOTS_IST (±20 min).
   - caption = Caption + "\n\n" + Hashtags
   - success → Status=Published, IG_Post_Link=permalink, Design_Link=first image URL, Posted_On_IG=Y on every row in Item_IDs, note in Run_Log
   - failure → keep Approved, write the error to Run_Log; stop retrying after 3 failed runs
   - --dry-run / DRY_RUN=true: render + upload, no publish
6. .github/workflows/publish.yml: cron "*/30 * * * *" + workflow_dispatch; Node 20 with npm cache in automation/; `npx playwright install --with-deps chromium`; `node publish.js`; env from GitHub Secrets.
7. .github/workflows/sync.yml: cron "0 2,8,14,20 * * *" (UTC = 7:30 AM IST and every 6 h) + workflow_dispatch; `node sync.js`.

Dry-run one Approved row, show me the JPEGs, then STOP and summarize.
```

#### Phase 4: Comment replies and DMs (Vercel function)

```
Continue beyondtheoffer. Phases 1–3 are done.

1. frontend/api/instagram-webhook.js (Vercel Node serverless function; must not affect the Vite build):
   - GET: verify hub.mode=subscribe and hub.verify_token === IG_WEBHOOK_VERIFY_TOKEN; return hub.challenge.
   - POST: verify X-Hub-Signature-256 (HMAC-SHA256 with IG_APP_SECRET) on the raw body; reject mismatches. Handle "comments" and "messages" changes. Respond quickly.
   - Confirm that vercel.json/rewrites for the SPA do not swallow /api/* routes; adjust only if needed.
2. Rules (put them in automation/lib/replies.js, shared or copied into the function):
   - Comment contains JOB / INTERN / LINK / AI → private reply DM (recipient = comment_id) with WEBSITE_URL and the apply links for that post (IG_Post_Link → Content_Queue row → Item_IDs → sheet links). Then a public reply: "Sent you the links in DM 📩".
   - Thanks/emoji → short friendly reply.
   - Questions → if ANTHROPIC_API_KEY is set, draft a reply (max 2 sentences, only facts from the post and the website link); otherwise leave it.
   - Never reply to our own comments or twice to the same comment. Skip rude, spam, political or personal comments; log them for manual review.
3. Log every event to a new sheet tab Comments_Log (create if missing): Time_IST, Comment_ID, Media_ID, Username, Text, Action, Reply_Text, Status.

Explain how to test with `vercel dev` + ngrok, then STOP and summarize.
```

#### Phase 5: Reels, stories, insights

```
Continue beyondtheoffer. Phases 1–4 are done. Extend automation/ only.

1. reels.js: turn a Content_Queue Reel script (HOOK/POINT/CTA lines) into a 1080x1920 MP4 (H.264, 30fps, 30–45s). Render text cards with Playwright and stitch them with ffmpeg (fades, on-screen captions; optional royalty-free track from automation/assets/).
2. Publish reels with media_type=REELS using resumable upload (upload_type=resumable → rupload.facebook.com) so no public video hosting is needed. Add Format=Reel to publish.js.
3. Stories: Format=Story → 1080x1920 JPEG frames → media_type=STORIES.
4. insights.js (once a day from sync.yml): per-media reach, saves, shares, likes, comments and account followers → new sheet tab Insights (create if missing).

Dry-run one reel, show me the MP4, then STOP and summarize.
```

### Deploy

1. Commit and push. Phases are non-destructive, so the existing Vercel and Render deploys keep working.
2. GitHub → **Settings → Secrets and variables → Actions** → add every variable from `automation/.env`. Use `GOOGLE_SA_JSON_B64`, not the file path.
3. Vercel (frontend project) → add the webhook variables listed above → redeploy.
4. Meta app → webhook URL `https://beyondtheoffer.vercel.app/api/instagram-webhook` → verify → subscribe to comments and messages.
5. Run **Actions → sync → Run workflow** and check the site.
6. Run **Actions → publish → Run workflow** with `DRY_RUN=true`, check the renders, then set `DRY_RUN=false`.

### Daily routine

| Time (IST) | What happens |
|---|---|
| ~6:36 AM | Claude adds new rows and drafts, marks expired items, writes Run_Log |
| ~7:30 AM | Sync puts verified rows on the website |
| Morning | You approve drafts in Content_Queue (5 minutes on your phone) |
| 9 AM / 1 PM / 7 PM | Publisher posts the next approved draft |
| All day | Webhook replies to comments and sends "Comment JOB" DMs |

### Rules

- Official Instagram API only. No bought followers, follow/unfollow bots or engagement pods.
- For Unified Login, use `https://graph.facebook.com/v26.0/{IG_USER_ID}/messages` for private replies.
  The JSON body is `{ "recipient": { "comment_id": "<webhook value.id>" }, "message": { "text": "..." } }`.
  Do not substitute the Instagram account ID, media ID, username, or commenter ID for `comment_id`.
- Don't scrape LinkedIn or Naukri. Every post links to an official source.
- News is written in our own words.
- Secrets live in `.env`, GitHub Secrets and Vercel env only, never in `VITE_` variables or git.

### Troubleshooting

| Problem | Fix |
|---|---|
| Google 403 | Share the sheet with the service account email as Editor |
| Image container fails | Must be a JPEG at a public URL; open the Cloudinary link in a private window to check |
| Container stuck | Poll once a minute, up to 5 min; containers expire after 24 h |
| Error subcode 2207042 | Publishing limit reached; check `content_publishing_limit` |
| Token error 190 | Generate a new long-lived token; update GitHub and Vercel secrets |
| `/api/instagram-webhook` returns the React page | SPA rewrite is catching `/api/*`; exclude it in `vercel.json` |
| Auto items not on site | Check the sync workflow log; only Official/Multi-source + Active rows sync |
| Admin edits overwritten | Check that `adminEdited` is set by the admin update controller |
### Automatic comment sync

The existing **Post now** action still asks for confirmation before publishing.
The existing manual **Sync Instagram replies** button remains available.

Automatic comment synchronization runs every 10 minutes through
`.github/workflows/instagram-replies.yml`. Add the same random value to the
GitHub Actions secret `INSTAGRAM_SYNC_SECRET` and the Vercel environment variable
`INSTAGRAM_SYNC_SECRET`. The workflow calls the existing admin-sheet endpoint and
retries for about a minute when Vercel or Google Sheets is briefly unavailable;
sheet calls also retry 429/5xx errors themselves.

### Comment → DM with a follow check (free, no ManyChat)

`frontend/api/_lib/followgate.js`, used by the webhook and the 10-minute sync:
1. A keyword comment (JOB, LINK, AI, …) gets one private DM: "Follow @beyond_the.offer, then reply DONE here". The public reply says "please check your DM".
2. When they reply DONE (or yes/followed/link), `is_user_follow_business` is checked. Followers get every apply link of that post; others are asked to follow first. If the check itself fails, the links are sent anyway.
3. If the DM can't be sent, the public reply carries the `/links/<ID>` page instead and the row is logged as `partial` with the reason.

`DM_FOLLOW_GATE=off` (Vercel env) sends the links in the first DM, without the follow step. Comments_Log gets two columns, `IG_Scoped_ID` and `Post_ID`; rows waiting for the follow have status `dm: waiting for follow`.

Instagram only delivers these DMs to the public when:
- the Meta app has **Advanced Access** for `instagram_manage_messages` and `instagram_manage_comments` and is Live (see `docs/meta-app-review.md`; free, needs business verification). Until then only accounts with a role on the app (testers) get DMs, and everyone else gets the public links reply. This is the most likely cause of the earlier `(code 100, subcode 2534039)` errors in Comments_Log.
- **Allow access to messages** is on: Instagram app → Settings → Messages and story replies → Message controls → Connected tools.
- The webhook is subscribed to **messages** as well as **comments**, because the DONE reply arrives as a message.

### Generated admin previews

The Instagram admin page can generate a real preview before posting. For Reel
rows it renders and uploads the same MP4 pipeline used by publishing; for
carousel/story rows it renders the actual JPEG slides. The preview is created
by `.github/workflows/instagram-preview.yml` and stored in the queue row's
`Preview_Link` column. It is a dry run only: Instagram publishing starts only
after **Confirm and post**.

Publishing is gated by both `Preview_Link` and `Publish_Confirmed=Y`. Approved
rows without a reviewed preview are skipped by the scheduled publisher, so a
post cannot reach Instagram before the admin confirms its generated output.

If preview generation shows `GitHub 403`, update the Vercel
`GH_DISPATCH_TOKEN`. For a fine-grained token, grant access to
`ar-pitha/BeyondTheOffer`, enable **Actions: Read and write**, and ensure the
token owner can run workflows. A classic token needs the repository workflow
permission. Do not paste the token into chat or source code.