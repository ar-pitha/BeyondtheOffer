// Parses the free-form dates the daily task writes in the sheet
// ("2026-11-12", "15/11/2026", "15 Nov 2026", "Nov 15, 2026", "6 Nov").
// Mirrors automation/lib/mapping.js parseSheetDate. Returns a Date or null.
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export function parseSheetDeadline(value) {
  const s = String(value ?? "").trim();
  if (!s || /^(rolling|asap|tba|tbd|na|n\/a|-|open|ongoing|soon)$/i.test(s)) return null;
  const year = new Date().getFullYear();

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);

  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3})[a-z]*(?:[\s,-]+(\d{4}))?$/i);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) return new Date(m[3] ? +m[3] : year, MONTHS[m[2].toLowerCase()], +m[1]);

  m = s.match(/^([a-z]{3})[a-z]*[\s-]+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/i);
  if (m && MONTHS[m[1].toLowerCase()] !== undefined) return new Date(m[3] ? +m[3] : year, MONTHS[m[1].toLowerCase()], +m[2]);

  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}
