// Google Sheets helpers shared by the Vercel webhook and automation/ scripts.
// Zero dependencies: the service-account JWT is signed with node:crypto.
// Files in api/_lib are not routes (Vercel skips "_" prefixed paths).

import crypto from "node:crypto";
import fs from "node:fs";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const API = "https://sheets.googleapis.com/v4/spreadsheets";

let cachedToken = null; // { token, expiresAt }

function loadServiceAccount() {
  if (process.env.GOOGLE_SA_JSON_B64) {
    return JSON.parse(Buffer.from(process.env.GOOGLE_SA_JSON_B64, "base64").toString("utf8"));
  }
  if (process.env.GOOGLE_SA_JSON_PATH) {
    return JSON.parse(fs.readFileSync(process.env.GOOGLE_SA_JSON_PATH, "utf8"));
  }
  throw new Error("Google credentials missing: set GOOGLE_SA_JSON_B64 or GOOGLE_SA_JSON_PATH");
}

const b64url = (input) => Buffer.from(input).toString("base64url");

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 })
  );
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key, "base64url");

  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google auth failed: ${data.error_description || data.error || res.status}`);

  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

// Google returns short-lived 429/5xx errors now and then; retry those with backoff.
// Appends retry only on 429/503 (rejected before writing), so a retry can't duplicate a row.
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1500, 4000, 9000];

async function sheetsFetch(path, { method = "GET", body } = {}) {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("SHEET_ID is not set");

  const retryable = (status) => (path.includes(":append") ? status === 429 || status === 503 : RETRY_STATUS.has(status));
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(`${API}/${sheetId}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok || !retryable(res.status) || attempt >= RETRY_DELAYS_MS.length) break;
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint = res.status === 403 ? " (share the sheet with the service account email as Editor)" : "";
    throw new Error(`Sheets ${method} ${path} → ${res.status}: ${data.error?.message || "error"}${hint}`);
  }
  return data;
}

const rangeOf = (tab, a1 = "A1:ZZ") => encodeURIComponent(`'${tab.replace(/'/g, "''")}'!${a1}`);

// 0 → A, 25 → Z, 26 → AA
export function columnLetter(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// Reads a tab as objects keyed by the header row. Each object also gets
// _row (1-based sheet row number) so it can be updated later.
export async function readTab(tab) {
  const data = await sheetsFetch(`/values/${rangeOf(tab)}?valueRenderOption=FORMATTED_VALUE`);
  const [headers = [], ...rows] = data.values || [];
  const items = rows
    .map((row, i) => {
      const obj = { _row: i + 2 };
      headers.forEach((h, c) => {
        obj[h.trim()] = (row[c] ?? "").toString().trim();
      });
      return obj;
    })
    .filter((obj) => headers.some((h) => obj[h.trim()] !== ""));
  return { headers: headers.map((h) => h.trim()), rows: items };
}

// Writes only the given columns of the row whose ID column equals id.
export async function updateRowById(tab, id, patch, { idColumn = "ID" } = {}) {
  const { headers, rows } = await readTab(tab);
  const row = rows.find((r) => r[idColumn] === id);
  if (!row) return false;
  await updateRow(tab, headers, row._row, patch);
  return true;
}

export async function ensureColumns(tab, required) {
  const { headers } = await readTab(tab);
  const missing = required.filter((name) => !headers.includes(name));
  if (!missing.length) return headers;
  const nextHeaders = [...headers, ...missing];
  await sheetsFetch(`/values/${rangeOf(tab, `A1:${columnLetter(nextHeaders.length - 1)}1`)}?valueInputOption=RAW`, {
    method: "PUT",
    body: { values: [nextHeaders] },
  });
  return nextHeaders;
}

// raw: true stores values as typed text, so "2026-11-02 19:00" isn't reformatted
// into a locale date that reads back differently.
export async function updateRow(tab, headers, rowNumber, patch, { raw = false } = {}) {
  const data = Object.entries(patch)
    .filter(([key]) => headers.includes(key))
    .map(([key, value]) => ({
      range: `'${tab}'!${columnLetter(headers.indexOf(key))}${rowNumber}`,
      values: [[value ?? ""]],
    }));
  if (data.length === 0) return;
  await sheetsFetch(`/values:batchUpdate`, {
    method: "POST",
    body: { valueInputOption: raw ? "RAW" : "USER_ENTERED", data },
  });
}

export async function appendRow(tab, headers, obj) {
  return sheetsFetch(`/values/${rangeOf(tab, "A1")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: { values: [headers.map((h) => obj[h] ?? "")] },
  });
}

// Creates the tab with a header row if it does not exist yet.
export async function ensureTab(tab, headers) {
  const meta = await sheetsFetch(`?fields=sheets.properties.title`);
  const exists = (meta.sheets || []).some((s) => s.properties.title === tab);
  if (exists) return false;
  await sheetsFetch(`:batchUpdate`, {
    method: "POST",
    body: { requests: [{ addSheet: { properties: { title: tab } } }] },
  });
  await sheetsFetch(`/values/${rangeOf(tab, "A1")}?valueInputOption=RAW`, {
    method: "PUT",
    body: { values: [headers] },
  });
  return true;
}

// Deletes whole rows (1-based sheet row numbers) from a tab.
export async function deleteRows(tab, rowNumbers) {
  if (!rowNumbers.length) return 0;
  const meta = await sheetsFetch(`?fields=sheets.properties(sheetId,title)`);
  const sheet = (meta.sheets || []).find((s) => s.properties.title === tab);
  if (!sheet) return 0;
  // Bottom-up so earlier deletions don't shift the rows still to delete
  const requests = [...new Set(rowNumbers)]
    .sort((a, b) => b - a)
    .map((row) => ({
      deleteDimension: {
        range: { sheetId: sheet.properties.sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row },
      },
    }));
  await sheetsFetch(`:batchUpdate`, { method: "POST", body: { requests } });
  return requests.length;
}

// Current date and time in IST (or TIMEZONE), formatted for sheet cells.
export function nowInZone(timeZone = process.env.TIMEZONE || "Asia/Kolkata", date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}
