// Company logos for the carousel cards, as data URIs so screenshots never wait on the network.
// Tried in order, first hit wins:
//   1. automation/assets/logos/<slug>.png|jpg|svg|webp   (drop a file in to fix a bad logo)
//   2. logo.dev, when LOGO_DEV_TOKEN is set              (best quality for small companies)
//   3. Wikidata's "logo image" (P154) from Wikimedia Commons, the company's real wordmark
//   4. the logo or emblem at the top of its Wikipedia article (Indian government bodies)
//   5. Google's favicon service, only when it has a real icon (64 px or more)
// Nothing found → null, and the card draws a monogram instead.

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./config.js";

const LOCAL_DIR = path.join(ROOT, "assets", "logos");
const CACHE_DIR = path.join(ROOT, "renders", ".logos");
const UA = { "User-Agent": "BeyondTheOffer/1.0 (https://beyondtheoffer.vercel.app)" };
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp" };

export const slugify = (name) =>
  String(name || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Companies the feed posts often, so the domain doesn't depend on the apply link
const KNOWN = {
  accenture: "accenture.com", adobe: "adobe.com", amazon: "amazon.com", "amazon-web-services": "aws.amazon.com",
  amd: "amd.com", apple: "apple.com", atlassian: "atlassian.com", "bajaj-finserv": "bajajfinserv.in",
  "bharat-electronics": "bel-india.in", bel: "bel-india.in", bhel: "bhel.com", capgemini: "capgemini.com",
  cisco: "cisco.com", cognizant: "cognizant.com", cred: "cred.club", deloitte: "deloitte.com",
  drdo: "drdo.gov.in", flipkart: "flipkart.com", freshworks: "freshworks.com", google: "google.com",
  hcl: "hcltech.com", hcltech: "hcltech.com", "hcl-technologies": "hcltech.com", "hdfc-bank": "hdfcbank.com",
  ibm: "ibm.com", "icici-bank": "icicibank.com", infosys: "infosys.com", intel: "intel.com", isro: "isro.gov.in",
  "jp-morgan": "jpmorgan.com", jpmorgan: "jpmorgan.com", "jpmorgan-chase": "jpmorganchase.com", lti: "ltimindtree.com",
  ltimindtree: "ltimindtree.com", meesho: "meesho.com", meta: "meta.com", microsoft: "microsoft.com", mphasis: "mphasis.com",
  myntra: "myntra.com", nvidia: "nvidia.com", ola: "olacabs.com", oracle: "oracle.com", paypal: "paypal.com",
  paytm: "paytm.com", phonepe: "phonepe.com", qualcomm: "qualcomm.com", razorpay: "razorpay.com", salesforce: "salesforce.com",
  samsung: "samsung.com", sap: "sap.com", sbi: "sbi.co.in", "state-bank-of-india": "sbi.co.in", ssc: "ssc.gov.in",
  "staff-selection-commission": "ssc.gov.in", swiggy: "swiggy.com", "tata-consultancy-services": "tcs.com",
  "tata-steel": "tatasteel.com", tcs: "tcs.com", "tech-mahindra": "techmahindra.com", uber: "uber.com",
  upsc: "upsc.gov.in", walmart: "walmart.com", "walmart-global-tech": "walmart.com", wipro: "wipro.com",
  zepto: "zeptonow.com", dsssb: "dsssb.delhi.gov.in", upessc: "upessc.up.gov.in", appsc: "psc.ap.gov.in", tspsc: "websitenew.tspsc.gov.in",
  dgma: "dgshipping.gov.in", "indian-air-force": "indianairforce.nic.in", "indian-army": "joinindianarmy.nic.in", "indian-navy": "joinindiannavy.gov.in",
  afcat: "afcat.cdac.in", nta: "nta.ac.in", bsnl: "bsnl.co.in", rbi: "rbi.org.in", lic: "licindia.in", aai: "aai.aero", "coal-india": "coalindia.in", powergrid: "powergrid.in", "power-grid": "powergrid.in", "j-and-k-bank": "jkbank.com",
  "jk-bank": "jkbank.com", "jandk-bank": "jkbank.com", "bank-of-baroda": "bankofbaroda.in", "canara-bank": "canarabank.com", "punjab-national-bank": "pnbindia.in",
  pnb: "pnbindia.in", "union-bank": "unionbankofindia.co.in", "axis-bank": "axisbank.com", "kotak-mahindra-bank": "kotak.com",
  stripe: "stripe.com", honeywell: "honeywell.com", "analog-devices": "analog.com", anthropic: "anthropic.com", openai: "openai.com",
  "texas-instruments": "ti.com", juspay: "juspay.in", groww: "groww.in", zerodha: "zerodha.com", "american-express": "americanexpress.com",
  barclays: "barclays.com", visa: "visa.com", mastercard: "mastercard.com", siemens: "siemens.com", bosch: "bosch.com", zoho: "zoho.com", zomato: "zomato.com", "goldman-sachs": "goldmansachs.com",
  "morgan-stanley": "morganstanley.com", deshaw: "deshaw.com", "de-shaw": "deshaw.com", ibps: "ibps.in", rrb: "indianrailways.gov.in",
  "railway-recruitment-board": "indianrailways.gov.in", "railway-recruitment-boards": "indianrailways.gov.in", "jammu-kashmir-bank": "jkbank.com",
  "cabinet-secretariat": "cabsec.gov.in", "central-warehousing-corporation": "cewacor.nic.in", cwc: "cewacor.nic.in", kea: "kea.kar.nic.in",
  "karnataka-examinations-authority": "kea.kar.nic.in", "andhra-pradesh-psc": "psc.ap.gov.in",
  "indian-railways": "indianrailways.gov.in", ongc: "ongcindia.com", ntpc: "ntpc.co.in", iocl: "iocl.com", gail: "gailonline.com",
  "smart-india-hackathon": "sih.gov.in", unstop: "unstop.com", devfolio: "devfolio.co", "mlh": "mlh.io",
};

// Job boards and ATS hosts say nothing about the company
const NOT_COMPANY_HOST = /(greenhouse|lever|myworkdayjobs|workday|smartrecruiters|ashbyhq|naukri|linkedin|indeed|instahyre|wellfound|cutshort|foundit|internshala|freshersworld|google\.com\/forms|forms\.gle|bit\.ly|docs\.google|notion|jobs\.ashby|careers-page|keka|darwinbox|zohorecruit|recruitee|bamboohr|icims|taleo|successfactors)/i;

export function domainFor({ name, domain, link } = {}) {
  if (domain) return String(domain).replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  // "Delhi Subordinate Services Selection Board (DSSSB)" → the DSSSB entry
  const known = KNOWN[slugify(name)] || KNOWN[slugify(knownIn(name))];
  if (known) return known;
  try {
    const host = new URL(link).hostname.toLowerCase();
    if (NOT_COMPANY_HOST.test(host)) return null;
    // careers.razorpay.com → razorpay.com, but keep ssc.gov.in / sbi.co.in whole
    const parts = host.replace(/^www\./, "").split(".");
    const keep = /^(gov|co|ac|nic|org|net|edu)$/.test(parts[parts.length - 2]) ? 3 : 2;
    const found = parts.slice(-keep).join(".");
    // An apply link on a recruitment portal (edcil, cdac, ...) isn't the company's site: the site's
    // name has to be in the company name, or be its initials ("DSSSB" → dsssb.delhi.gov.in)
    const label = found.split(".")[0];
    const words = String(name || "").toLowerCase();
    const initials = (words.match(/\(([a-z]+)\)/) || [])[1] || words.split(/[^a-z]+/).filter((w) => w.length > 2).map((w) => w[0]).join("");
    return words.replace(/[^a-z]/g, "").includes(label) || (initials && (initials === label || host.includes(initials))) ? found : null;
  } catch {
    return null;
  }
}

async function fetchImage(url, timeoutMs = 8000) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") || "").split(";")[0].trim();
  if (!type.startsWith("image/")) return null;
  return { type, bytes: Buffer.from(await res.arrayBuffer()) };
}

// PNG width/height from the IHDR chunk; other formats are trusted
const pngSize = (b) => (b.length > 24 && b.readUInt32BE(0) === 0x89504e47 ? Math.min(b.readUInt32BE(16), b.readUInt32BE(20)) : Infinity);

async function fromWikidata(name, domain) {
  const api = "https://www.wikidata.org/w/api.php?format=json&";
  const search = await (await fetch(`${api}action=wbsearchentities&language=en&limit=6&search=${encodeURIComponent(name)}`, { headers: UA })).json();
  const ids = (search.search || []).map((x) => x.id);
  if (!ids.length) return null;
  const { entities } = await (await fetch(`${api}action=wbgetentities&props=claims&ids=${ids.join("|")}`, { headers: UA })).json();
  // Official website, only when it's a site root: google.com/maps is Google Maps, not Google
  const host = (id) => {
    try {
      const url = new URL(entities[id]?.claims?.P856?.[0]?.mainsnak?.datavalue?.value);
      return url.pathname.length > 1 ? "" : url.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  };
  const brand = domain ? domain.split(".")[0] : "";
  // The current logo: the preferred-rank one, else the newest listed
  const logo = (id) => {
    const claims = (entities[id]?.claims?.P154 || []).filter((c) => c.rank !== "deprecated" && c.mainsnak?.datavalue);
    return (claims.find((c) => c.rank === "preferred") || claims[claims.length - 1])?.mainsnak.datavalue.value;
  };
  // With a domain, the most relevant entity whose site is that domain or the same brand (about.google);
  // otherwise the top hit that has a logo and a website
  const matches = (h) => h && (h === domain || h.split(".").includes(brand));
  const pick = ids.find((id) => logo(id) && (domain ? matches(host(id)) : host(id)));
  if (!pick) return null;
  return fetchImage(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(logo(pick))}?width=600`);
}

// The image at the top of the organisation's Wikipedia article, when it's a logo or emblem.
// Covers Indian government bodies (IBPS, Indian Railways) that Wikidata has no logo for.
async function fromWikipedia(name) {
  const url = `https://en.wikipedia.org/w/api.php?format=json&action=query&redirects=1&prop=pageimages&piprop=name&titles=${encodeURIComponent(name)}`;
  const { query } = await (await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) })).json();
  const file = Object.values(query?.pages || {})[0]?.pageimage;
  if (!file || !/logo|emblem|insignia|seal|symbol/i.test(file)) return null;
  return fetchImage(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=600`);
}

// Last resort (government sites mostly): an image named "logo" on the homepage, else its touch icon
async function fromHomepage(domain) {
  const res = await fetch(`https://${domain}`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const html = (await res.text()).slice(0, 400_000);
  const urls = (re) => [...html.matchAll(re)].map((m) => m[1]);
  // Only logo files named after the site itself ("sscLogo.webp" on ssc.gov.in): other "logo" images
  // on a homepage are usually partners' logos. The touch icon is the site's own.
  const brand = domain.split(".")[0];
  const candidates = [
    ...urls(/<(?:img|link)[^>]+(?:src|href)=["']([^"']*logo[^"']*\.(?:png|svg|webp|jpe?g)[^"']*)["']/gi).filter((u) => u.toLowerCase().includes(brand)),
    ...urls(/<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/gi),
    ...urls(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon/gi),
  ];
  for (const src of candidates) {
    const img = await fetchImage(new URL(src, `https://${domain}/`).href).catch(() => null);
    if (img && pngSize(img.bytes) >= 64) return img;
  }
  return null;
}

async function lookup({ name, domain }) {
  const tries = [];
  if (domain && process.env.LOGO_DEV_TOKEN) {
    tries.push(() => fetchImage(`https://img.logo.dev/${domain}?token=${process.env.LOGO_DEV_TOKEN}&size=400&format=png&retina=true`));
  }
  if (name) {
    // "Delhi Subordinate Services Selection Board (DSSSB)" searches better without the bracket
    const plain = name.replace(/\s*\([^)]*\)/g, "").trim();
    tries.push(() => fromWikidata(plain || name, domain));
    tries.push(() => fromWikipedia(plain || name));
  }
  if (domain) {
    tries.push(async () => {
      const img = await fetchImage(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`);
      return img && pngSize(img.bytes) >= 64 ? img : null;
    });
  }
  if (domain) tries.push(() => fromHomepage(domain));
  for (const attempt of tries) {
    const img = await attempt().catch(() => null);
    if (img && img.bytes.length > 200) return img;
  }
  return null;
}

const toDataUri = ({ type, bytes }) => `data:${type};base64,${bytes.toString("base64")}`;

export async function logoFor({ name, domain, link } = {}) {
  const slug = slugify(name || domain);
  if (!slug) return null;
  // A committed file wins, under the full name or any name for the same site
  // ("Railway Recruitment Boards" → indianrailways.gov.in → rrb.jpg)
  const site = domainFor({ name, domain, link });
  const aliases = site ? Object.keys(KNOWN).filter((k) => KNOWN[k] === site) : [];
  for (const s of new Set([slug, slugify(knownIn(name) || ""), ...aliases].filter(Boolean))) {
    for (const ext of Object.keys(MIME)) {
      const file = path.join(LOCAL_DIR, `${s}.${ext}`);
      if (fs.existsSync(file)) return toDataUri({ type: MIME[ext], bytes: fs.readFileSync(file) });
    }
  }
  const cached = path.join(CACHE_DIR, `${slug}.json`);
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, "utf8")).uri;

  const img = await lookup({ name, domain: site });
  if (!img) return null;
  const uri = toDataUri(img);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cached, JSON.stringify({ uri }));
  return uri;
}

// The best-known company named in free text ("SSC CGL 2026" → "SSC"), for drafts with no sheet row
export function knownIn(text) {
  const t = String(text || "");
  let best = null;
  for (const key of Object.keys(KNOWN)) {
    const m = t.match(new RegExp(`(^|[^A-Za-z])(${key.replace(/-/g, "[\\s-]+")})(?![A-Za-z])`, "i"));
    if (m && (!best || m[2].length > best.length)) best = m[2];
  }
  return best;
}
