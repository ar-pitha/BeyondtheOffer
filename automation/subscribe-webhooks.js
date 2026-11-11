// Turns on the Instagram webhook events the comment → DM flow needs, for the Meta app and for
// the Instagram account, then prints what is subscribed. Safe to run again.
//   node subscribe-webhooks.js          subscribe, then show
//   node subscribe-webhooks.js --show   only show
// Needs IG_APP_ID, IG_APP_SECRET, IG_WEBHOOK_VERIFY_TOKEN, IG_ACCESS_TOKEN and IG_USER_ID in .env.

import "./lib/config.js";
import { igRequest, igUserId } from "../frontend/api/_lib/instagram.js";

// messaging_postbacks carries the taps on the DONE button
const FIELDS = "comments,messages,messaging_postbacks";
const CALLBACK = `${process.env.WEBSITE_URL || "https://beyondtheoffer.vercel.app"}/api/instagram-webhook`;
const { IG_APP_ID: appId, IG_APP_SECRET: secret, IG_WEBHOOK_VERIFY_TOKEN: verify } = process.env;
const appUrl = `https://graph.facebook.com/${process.env.IG_API_VERSION || "v26.0"}/${appId}/subscriptions`;
const appToken = `${appId}|${secret}`;
const hideIds = (value) => JSON.stringify(value).replace(/[0-9]{12,}/g, "<id>");

if (!process.argv.includes("--show")) {
  const body = new URLSearchParams({ object: "instagram", callback_url: CALLBACK, fields: FIELDS, verify_token: verify, access_token: appToken });
  console.log("app:", hideIds(await (await fetch(appUrl, { method: "POST", body })).json()));
  console.log("account:", hideIds(await igRequest(`${igUserId()}/subscribed_apps`, { method: "POST", params: { subscribed_fields: FIELDS } })));
}
console.log("app subscriptions:", hideIds(await (await fetch(`${appUrl}?access_token=${encodeURIComponent(appToken)}`)).json()));
console.log("account subscriptions:", hideIds(await igRequest(`${igUserId()}/subscribed_apps`)));
