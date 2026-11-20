// Companies students search for by name. An opening at one of these gets a reel of its own (one
// company per reel is what travels in this niche); the rest are grouped into carousels.
// Matched on whole words at the start of the company name: "Amazon Web Services" and
// "Google India" count, "Amazonia Labs" doesn't.

const BIG_BRANDS = [
  // Global tech
  "Google", "Alphabet", "Microsoft", "Amazon", "AWS", "Apple", "Meta", "Netflix", "NVIDIA", "Adobe",
  "Salesforce", "Oracle", "IBM", "Intel", "AMD", "Qualcomm", "Cisco", "Intuit", "Uber", "Atlassian",
  "PayPal", "LinkedIn", "Samsung", "Walmart", "Visa", "Mastercard", "American Express", "Texas Instruments",
  // Banks and consulting that freshers apply to in numbers
  "Goldman Sachs", "JPMorgan", "Bank of America", "Citi", "Barclays", "HSBC", "J.P. Morgan", "JP Morgan", "Morgan Stanley", "Deloitte", "EY", "KPMG", "PwC",
  "Accenture",
  // Indian names every batch knows
  "TCS", "Tata Consultancy Services", "Infosys", "Wipro", "HCLTech", "HCL", "Tech Mahindra", "Flipkart",
  "Zomato", "Swiggy", "Paytm", "PhonePe", "Razorpay", "Zoho", "Reliance", "Jio", "L&T", "Larsen & Toubro",
  // Government
  "ISRO", "DRDO", "BARC", "SBI", "State Bank of India", "RBI", "Reserve Bank of India", "Indian Railways",
  "Railway Recruitment Board", "Indian Army", "Indian Navy", "Indian Air Force", "UPSC", "SSC", "ONGC",
  "NTPC", "BHEL", "IOCL", "Indian Oil", "GAIL", "POWERGRID", "BEL",
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERN = new RegExp(`^(?:${BIG_BRANDS.map(esc).join("|")})(?![\\p{L}\\p{N}])`, "iu");

export const isBigBrand = (company) => PATTERN.test(String(company || "").replace(/^the\s+/i, "").trim());

// The company field of a sheet row, whatever its tab
export const companyOf = (item) => item.Company || item.Organisation || item.Organiser || "";
