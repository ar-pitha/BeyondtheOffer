# Meta App Review: BeyondTheOffer

App ID `1823362508812825` · Instagram account `@beyond_the.offer` (17841449645328149)

Goal: **Advanced Access** for `instagram_manage_comments` and `instagram_manage_messages`, so the bot can reply to comments and DMs from real followers, not only accounts with a role on the app.

Request only these. `instagram_basic`, `instagram_content_publish` and `instagram_manage_insights` are used only on our own account and already work with Standard Access.

## Before you submit

1. **Business verification.** In Meta Business Suite → Settings → Business info → Security center → *Start verification* for business `2097197541199401`. Use a document that shows the business or your name and address (GST/Udyam certificate, utility bill or bank statement). Advanced Access is not granted without it.
2. **Become a Tech Provider** (the dashboard asks for it before App Review): App dashboard → *Become a Tech Provider*. Fill in the business details.
3. **App icon.** App settings → Basic → App icon, upload `automation/renders/app-icon-1024.png` (1024×1024).
4. Privacy policy, terms and data deletion URLs are already saved:
   - https://beyondtheoffer.vercel.app/privacy
   - https://beyondtheoffer.vercel.app/terms
   - https://beyondtheoffer.vercel.app/data-deletion
5. Give a reviewer a way in. Reviewers test by commenting on a post themselves, so keep at least one recent post with a clear "Comment JOB for the links" call to action.

## App description (App Review → "Tell us how you'll use…")

> BeyondTheOffer is a free careers page for students and freshers in India. We publish verified job openings, government exam notifications and hackathons on our website (beyondtheoffer.vercel.app) and on our own Instagram professional account, @beyond_the.offer. Every post links to the official source.
>
> The app only acts on our own Instagram account. It publishes our own posts, and it answers people who comment on or message our account asking for the apply links. We do not access other businesses' accounts, sell data, or use it for advertising.

## instagram_manage_comments

**How we use it**

> Our posts end with "Comment JOB and we'll DM you the links". When someone comments on one of our posts, our webhook receives the comment, and the app:
> 1. Reads the comment text to decide what the person wants (links, a thank-you, a question).
> 2. Replies publicly under the comment, for example "Sent you the links in DM 📩", or a short thank-you.
> 3. Logs the comment ID and our reply so we never reply twice.
>
> We only read and reply to comments on media owned by @beyond_the.offer. Rude, spam, political or personal comments are never answered automatically; they are logged for a person on our team to review. Without this permission, people who ask for the links in the comments would get no answer.

**Why Advanced Access:** the people commenting are our followers and the public, not users with a role on our app.

## instagram_manage_messages

**How we use it**

> When someone comments a keyword such as JOB, INTERN or LINK on our post, we send them one private reply (a DM to the commenter, via the comment ID) containing the official apply links for the openings in that post, plus a link to our website. When someone sends us a DM asking for links, we reply with our website link. When someone DMs "DELETE MY DATA", we confirm the request and delete their data within 30 days, as described at beyondtheoffer.vercel.app/data-deletion.
>
> We only message people who commented on our post or messaged us first, only about what they asked for, and never send promotional or bulk messages.

**Why Advanced Access:** the people asking for the links are members of the public.

## Screen recording (one video covers both permissions)

Record at 1080p, about 2 minutes, no music. Use a **second Instagram account** (a personal one) as "the follower", and show both phones or browser windows side by side if you can.

1. **0:00** Open https://beyondtheoffer.vercel.app and show a job listing with its official apply link. Say or caption: "We post verified openings for students."
2. **0:15** Open an @beyond_the.offer post on Instagram that says "Comment JOB and we'll DM you the links".
3. **0:25** From the follower account, comment **JOB** on that post.
4. **0:35** Refresh the post: show the public reply "Sent you the links in DM 📩" from @beyond_the.offer. *(instagram_manage_comments)*
5. **0:45** Open the follower account's inbox: show the DM from @beyond_the.offer with the apply links and website link. *(instagram_manage_messages)*
6. **1:00** Tap one link to show it opens the official job page.
7. **1:10** From the follower account, comment "Thank you!" and show the short public thank-you reply.
8. **1:25** From the follower account, DM **DELETE MY DATA** and show the confirmation reply. Then open https://beyondtheoffer.vercel.app/data-deletion.
9. **1:40** Show https://beyondtheoffer.vercel.app/privacy.

The webhook only fires for accounts with a role on the app until Advanced Access is approved. Before recording, add the follower account in **App roles → Roles → Instagram testers** and accept the invite in Instagram (Settings → Website permissions → Apps and websites → Tester invites).

## Test instructions for the reviewer

> 1. Open https://www.instagram.com/beyond_the.offer and pick any recent post.
> 2. Comment "JOB" on it.
> 3. Within about 10 seconds you'll get a public reply under your comment and a direct message with the official apply links.
> 4. DM "DELETE MY DATA" to @beyond_the.offer to see the data deletion flow.
>
> No login to our website is needed. The privacy policy is at https://beyondtheoffer.vercel.app/privacy.

## After approval

Nothing changes in code or settings. The same token, app secret and webhook keep working, and comments from everyone start arriving at `/api/instagram-webhook`.
