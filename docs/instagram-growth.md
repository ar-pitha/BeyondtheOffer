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
- Two posting slots by default: `13:00,19:00` IST.
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

## What only you can do (in order of impact)

1. **Approve every day.** Open `/admin/feed` once a morning and approve or reject everything. Reject stale drafts whose deadlines have passed. Target: 1 reel + 1 carousel a day, every day, for 30 days. Nothing else on this list matters if posting stays at 3 a month.
2. **Change the profile** (Edit profile in the app):
   - Name: `Jobs for Freshers | Off Campus Drives` (this is what search matches)
   - Bio:
     ```
     Off campus drives, internships & govt jobs for freshers
     Verified links daily, 1 PM & 7 PM IST
     Comment JOB on any post for the apply links 👇
     ```
   - Pin your 3 best posts. Add highlights: Jobs, Govt Jobs, Hackathons.
3. **Give the token the insights permission.** Regenerate the Instagram token with `instagram_business_manage_insights` (Instagram login) or `instagram_manage_insights` (Facebook login). Update `IG_ACCESS_TOKEN` in GitHub secrets and Vercel. After that the Insights tab fills daily, and you can see which posts actually reached people.
4. **Trial reels, later.** Once the account passes about 1,000 followers, set the repo variable `REEL_TRIAL=auto` (GitHub → Settings → Variables). Before that the API is likely to reject it, and the publish run fails with the error in Run_Log.
5. **Collab posts with student pages.** DM college placement cells, coding clubs, GDSC/MLSA chapters and campus ambassador pages. Offer a weekly "openings for your batch" post as a collab. Put their username in the `Collaborators` column. One accepted collab with a 5k-follower page reaches more students than a month of solo posts.
6. **Share every post where students already are.** Post to WhatsApp/Telegram placement groups and LinkedIn. Shares and saves are the strongest signals for reach to non-followers.
7. **20 minutes a day of real comments** on bigger fresher/placement pages (useful replies, not "nice post"). That's how a new account gets profile visits.
8. **Put a human in some reels.** A face or a real voice talking about one opening ("Infosys is hiring 2025 grads at ₹21 LPA, deadline Thursday") beats templated TTS slides. Keep the automated reels as the daily baseline. Optionally set `REEL_VOICE=en-IN-NeerjaExpressiveNeural` so the voice sounds Indian.

## Brief for the daily drafting task

Paste this into the Claude scheduled task that writes Content_Queue rows:

```
Instagram drafts (Content_Queue) – rules for reach:
- Every day draft at least 1 Reel and 1 Carousel. The reel matters most.
- The daily reel is about jobs, internships, govt deadlines or hackathons. At most one
  news/AI reel a week.
- Niche: openings and deadlines for Indian freshers (2025–2027 batches). Prefer jobs,
  internships, govt jobs and hackathons over general tech/AI news.
- Reel HOOK: one concrete claim with a number, a company or a deadline, under 10 words
  on screen. E.g. "Infosys is hiring 2025 grads at ₹21 LPA" or "3 drives close this
  Friday". No "Tech in 60 seconds", no greetings, no "this week in".
- 3 to 4 POINT lines, one opening each, written as short fields, not sentences:
  "POINT: Stripe | Software Engineer Intern | CS and maths students | Bengaluru".
- One idea per reel. 20–30 seconds total. No "(0-3s)" timings, no VISUALS line.
- CTA: exactly one ask: "Comment JOB for the apply links".
- Caption line 1 (first 125 characters) states the ask or the number plainly.
  Put the phrase students search ("jobs for freshers", "off campus drive 2026",
  "internship for 2027 batch", "government jobs") in a normal sentence in the body.
- No URLs in the caption. No hashtags in the caption text.
- Hashtags column: at most 5, specific to the post (company or exam names first,
  e.g. #infosys #rrbntpc), never #viral #fyp #explore #beyondtheoffer.
- Don't draft posts whose deadline is under 2 days away.
- Never invent salaries, dates, vacancies or eligibility.
```

## Expectations

1 million views and 100 followers from 30 followers isn't something any setting guarantees. The usual path for a niche page posting daily for 30 days is a few reels at 1k–10k views, then occasionally one breaks out. Follows come when a profile visitor sees a full, useful grid. Do not buy followers, likes or views, and don't use follow/unfollow bots. Instagram detects them and suppresses the account's reach, which is the opposite of the goal.

Judge it after 30 days of daily posting with insights on. Look at reach to non-followers, shares and saves per post, then make more of what worked (`/ig-audit` can read the Insights tab).
