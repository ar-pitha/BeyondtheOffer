# Instagram growth: what's holding @beyond_the.offer back

Audit date: 2026-11-06. Numbers come from the Graph API that day.

## What the data says

| Finding | Evidence | Effect on reach |
|---|---|---|
| Too few posts | 3 posts in the last 30 days, 7 in total | The algorithm has almost nothing to test with non-followers. Small accounts grow on volume plus consistency. |
| Drafts never approved | Content_Queue: 8 rows still `Draft`, several with deadlines already past | The daily task writes 3 drafts a day, but only about 1 in 4 reaches Instagram. |
| One slot a day, one category | `POST_SLOTS_IST=19:00`, and a row only posted if it matched the day's rotation | Even approved rows waited for "their" day. |
| Profile name is not searchable | Name field is "Arpita..✯" | Instagram search matches the **name field** and username. Nobody searching "jobs for freshers" can find the account. |
| Hashtag stuffing | 13 to 19 hashtags per post | Instagram capped posts at 5 hashtags in Dec 2025. Hashtags are labels, not reach. |
| Dead URL in captions | `🔗 All apply links: beyondtheoffer.vercel.app/links/...` | Caption links aren't clickable, and the post had two asks (link + comment). |
| Blank first frame on reels | Frame 0 was an empty background; the hook appeared at about 1 s | First frame is the cover, the first impression, and what muted viewers judge. |
| Insights blocked | `(#10) Application does not have permission` on every post | There's no reach, views or saves data, so you can't tell what works. |
| Generic AI-news reels | "Tech in 60 seconds" | Competes with huge tech pages. The niche you can win is **deadlines and openings for Indian freshers**. |

## Fixed in code (this change)

- `publish.js` posts the next approved row when today's category has nothing approved. It prefers reels, then carousels, then stories, because stories don't reach non-followers.
- Two posting slots by default: `13:00,19:00` IST. (Since 11 Nov 2026: no timer at all; each post goes out when it's published from the admin.)
- At most 5 hashtags: the row's own specific tags first, then category defaults. Brand tag dropped.
- One search phrase per category ("jobs for freshers", "government jobs", "hackathon") is added to captions that lack it. It goes before the closing ask. Instagram search reads caption words.
- No URL line in captions. The comment keyword DMs the `/links/<ID>` page.
- `Collaborators` column (optional) on Content_Queue: invite up to 3 accounts to a reel or carousel.
- `REEL_TRIAL=manual|auto` repo variable: reels go out as trial reels to non-followers first.
- Reel hook is fully on screen from frame 0.

## Follow-up, 2026-11-10

30 followers, 8 posts in 10 days, 2 to 8 likes each. Cadence is better; the content mix is the problem now.

- Every reel published so far is "Tech in 60 seconds" AI news (5 of 5). No job reel has gone out, and 11 job/internship drafts are still `Draft`. The brief below was never pasted into the daily task.
- News reels run 60 s with 15 s paragraphs per point. Watch time is the first ranking signal, so keep reels at 20 to 30 s with one line per point.
- Fixed: a news reel that mentioned "hackathon" was filed under events, so it got the hackathon caption line and look. Rows made only of `TN-` items are now always news/ai (`lib/category.js`).
- Fixed: captions no longer open on the series title ("Tech in 60 seconds ⚡"); they open on the first real item (`publish.js`).
- Added two job reels as `Draft`: `CQ-20261110-04` (internships) and `CQ-20261110-05` (govt deadlines). Use them as the pattern.
- Leave `REEL_TRIAL` empty for now: trial reels are reported to need about 1,000 followers, and a rejected publish counts as a failed run.

## Change, 2026-11-11: carousels only

No more AI-voice reels. Every Instagram post is now a clean white carousel
(`automation/lib/post.js`, `templates/post.html`), rendered at 1440x1800 so text stays sharp:

1. **Cover**: the hook, one line under it, and the logos of every company in the post.
2. **One card per opening**, built from the sheet row in `Item_IDs`: the company's real logo,
   company, role, and only the facts that matter (eligibility, location, salary/stipend, apply by;
   for govt: posts, qualification, age limit, last date). Job/requisition numbers, advert codes and
   "not stated" placeholders are left out.
3. **Profile card**: the account's Instagram profile picture, handle, Follow, "Comment JOB".

No slide numbers (Instagram shows its own). Drafts without sheet rows fall back to the draft's lines,
one card per line.

- Old `Reel` and `Story` drafts are posted as carousels too. A row whose approved preview is a video
  is skipped until you press **Regenerate** in `/admin/feed` and approve the new slides.
- Logos: Wikidata/Wikimedia wordmarks, then the company site. Set the optional `LOGO_DEV_TOKEN`
  secret (free at logo.dev) for sharper logos of small startups. If a logo is wrong, drop a PNG or
  SVG into `automation/assets/logos/<company-slug>.png` (e.g. `j-and-k-bank.png`) and it wins.
- Preview locally: `cd automation; node publish.js --dry-run --sample --id CQ-SAMPLE-1`, slides land
  in `automation/renders/CQ-SAMPLE-1/`.

## What only you can do (in order of impact)

1. **Publish every day.** Open `/admin/feed`, check the two new drafts and press Publish to Instagram on each (it posts straight away; there is no timer). Reject anything stale. Then share each post to your story from the Instagram app. Target: 2 posts a day (one jobs, one hackathons/news), every day, for 30 days. Nothing else on this list matters if posting stays at 3 a month.
2. **Change the profile** (Edit profile in the app):
   - Name: `Jobs for Freshers & Govt Jobs` (this is what search matches; the API can't change it)
   - Bio (fresh start on 11 Nov 2026):
     ```
     Fresh start · 11.11.2026
     Off campus drives, internships & govt jobs
     Verified jobs, hackathons & tech news daily
     Comment JOB for apply links
     ```
   - Pin your 3 best posts. Add highlights: Jobs, Govt Jobs, Hackathons.
3. **Give the token the insights permission.** Regenerate the Instagram token with `instagram_business_manage_insights` (Instagram login) or `instagram_manage_insights` (Facebook login). Update `IG_ACCESS_TOKEN` in GitHub secrets and Vercel. After that the Insights tab fills daily, and you can see which posts actually reached people.
4. **Trial reels, later.** Once the account passes about 1,000 followers, set the repo variable `REEL_TRIAL=auto` (GitHub → Settings → Variables). Before that the API is likely to reject it, and the publish run fails with the error in Run_Log.
5. **Collab posts with student pages.** DM college placement cells, coding clubs, GDSC/MLSA chapters and campus ambassador pages. Offer a weekly "openings for your batch" post as a collab. Put their username in the `Collaborators` column. One accepted collab with a 5k-follower page reaches more students than a month of solo posts.
6. **Share every post where students already are.** Post to WhatsApp/Telegram placement groups and LinkedIn. Shares and saves are the strongest signals for reach to non-followers.
7. **20 minutes a day of real comments** on bigger fresher/placement pages (useful replies, not "nice post"). That's how a new account gets profile visits.
8. **Put a human in some reels.** A face or a real voice talking about one opening ("Infosys is hiring 2025 grads at ₹21 LPA, deadline Thursday") beats templated TTS slides. Keep the automated reels as the daily baseline. Optionally set `REEL_VOICE=en-IN-NeerjaExpressiveNeural` so the voice sounds Indian.

## Brief for the daily drafting task

**Since 12 Nov 2026 the task should draft only the news post.** Job, govt and hackathon carousels
are grouped by `automation/group.js` (4 most urgent trusted openings per category, one carousel
waiting per category), and any job or hackathon draft written another way is marked Rejected on
the next run. Replace the "2 rows, two lanes" rule below with: "Draft 1 row a day, the news post
(TN- items only). Do not draft posts from TJ-, GJ- or HQ- items; keep adding those rows to their
tabs with Verified and the closing date filled in, because the grouping reads them."

Paste this into the Claude scheduled task that writes Content_Queue rows (updated 11 Nov 2026: two posts a day in two lanes, no emojis, no timer):

```
Instagram drafts (Content_Queue) – carousels only, no reels, no voiceover:
- Every day draft exactly 2 rows with Format=Carousel, and keep the two lanes apart:
    Post 1, JOBS: tech jobs/internships (TJ-) and/or govt jobs (GJ-) only.
    Post 2, EVENTS & NEWS: hackathons/contests (HQ-) or tech/AI news (TN-) only.
  Never put a job and a hackathon or news story in the same post. On a day with no fresh
  hackathon, Post 2 is the news post (3 stories from the last 2 days), and the other way round.
- Leave Scheduled_Time_IST empty: nothing posts on a timer; the admin publishes by hand.
- No emojis anywhere: not in the hook, the slides, the caption or the title.
- Never repeat an opening: skip any item with Posted_On_IG=Y (Used_In_Post=Y for news), and any
  item already listed in another Content_Queue row that isn't Rejected. One company role, one post.
  If a repeat slips through, only that opening is dropped: the publish run leaves it off the slides
  and out of the caption and posts the rest (a post with nothing new left isn't posted).
- News posts use the "Did you know?" design automatically: pick 3 stories with a surprising number
  or first, and fill Why_It_Matters_For_Students in Tech_News for each (it's shown on the slide).
- Niche: openings and deadlines for Indian freshers (2025–2027 batches).
- 3 to 6 openings per carousel. Put every item's ID in Item_IDs so the slide gets the company's
  real logo and the DM gets the right apply link.
- Slides_or_Script, one line per slide, fields split with "|":
    Slide 1: <hook> | <one-line promise>
    Slide 2: <Company> | <Role> | <Batch/eligibility> | <Location · Salary> | Verified: Official | Apply by YYYY-MM-DD
    ... one slide per opening, same shape (govt: <Organisation> | <Post/Exam> | <Vacancies> | <Qualification> | Verified: Official | Last date YYYY-MM-DD)
    Last slide (cta): Save this before the deadlines
  The recap and "Comment JOB" slides are added automatically.
- HOOK (slide 1), 6 to 10 words, always concrete. Use one of these:
    number + deadline:  "5 off campus drives closing this week"
    big names:          "Google, Stripe and Qualcomm are hiring interns"
    batch call-out:     "2026 batch: 4 companies hiring right now"
    money:              "Internships paying ₹50,000 a month, apply by Friday"
    govt numbers:       "6,000+ govt posts close by 26 November"
    loss:               "Don't miss these 3 drives closing in 48 hours"
  Wrap the one word to colour in *stars*: "*5* drives closing this week". Never "Tech in 60 seconds",
  never a greeting, never "this week in".
- News posts (Post 2 on news days): hook names the biggest story ("Siri AI is open to every
  developer now"), 3 stories, last line "Comment LINK for the sources."
- Caption:
    line 1 (shows before "... more"): the hook again in different words, with the number.
    body: one short line per opening ("Razorpay · SDE Intern · apply by 12 Nov").
    keywords in normal sentences: "off campus drive 2026", "jobs for freshers", "internship for
    2027 batch", "government jobs 2026", "<company> hiring freshers".
    last line, the only ask: "Comment JOB and we'll DM you every apply link."
    No URLs, no hashtags in the caption text.
- Hashtags column: at most 5, specific first (#razorpay #offcampusdrive #jobsforfreshers
  #2026batch #internship). Never #viral #fyp #explore #beyondtheoffer.
- Don't draft openings whose deadline is under 2 days away. Never invent salaries, dates,
  vacancies or eligibility.
```

## Expectations

Millions of views and followers isn't something any template or setting guarantees. The usual path for a niche page posting daily for 30 days is a few reels at 1k–10k views, then occasionally one breaks out. Follows come when a profile visitor sees a full, useful grid. Do not buy followers, likes or views, and don't use follow/unfollow bots. Instagram detects them and suppresses the account's reach, which is the opposite of the goal.

Judge it after 30 days of daily posting with insights on. Look at reach to non-followers, shares and saves per post, then make more of what worked (`/ig-audit` can read the Insights tab).
