import * as cheerio from 'cheerio';

// Converts Thai numerals (๐–๙) to Arabic so sutta numbers are queryable.
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
export function thaiToArabic(s = '') {
  return String(s).replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
}

function clean(text = '') {
  return text
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Extract the readable body from an 84000.org reader page.
//
// NOTE ON SELECTORS: 84000.org's markup has shifted over the years. The body
// text is rendered inside the main content cell; nav/menus/scripts are noise.
// We remove obvious chrome, then read the text. If you find the live DOM uses a
// stable container id/class, set CONTENT_SELECTOR to it for cleaner output.
const CONTENT_SELECTOR = null; // e.g. '#content', '.tipitaka-body' — set after inspecting live DOM

export function extractBodyText(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, header, footer, form').remove();
  const root = CONTENT_SELECTOR && $(CONTENT_SELECTOR).length ? $(CONTENT_SELECTOR) : $('body');
  // Preserve paragraph breaks: turn block tags into newlines.
  root.find('br').replaceWith('\n');
  root.find('p, div, tr, li, h1, h2, h3, h4').each((_, el) => {
    $(el).append('\n');
  });
  return clean(root.text());
}

// Segment a volume's body text into suttas / meaningful sub-sections.
//
// Strategy (semantic, not character-based):
//   1. Split on numbered item markers "[๑]" / "๑." / "ข้อ ๑" that head each ข้อ.
//   2. Carry the nearest preceding sutta title (a line ending in "สูตร" / "วรรค"
//      / "ขันธกะ" etc.) as the section's sutta name.
// Returns: [{ suttaName, suttaNumber, pageRef, text }]
//
// The markers below cover the common cases across all three piṭakas. Adjust the
// TITLE_RE / ITEM_RE if a particular volume uses an unusual convention.
// A title is a SHORT standalone line that either starts with "เรื่อง" or carries
// a structural keyword. Keywords cover all three piṭakas:
//   Vinaya : กัณฑ์ สิกขาบท วิภังค์ บทภาชนีย์ ภาณวาร ขันธกะ
//   Sutta  : สูตร วรรค นิทเทส ปัณณาสก์ นิบาต
// The (?<!วิ) lookbehind stops the woeful-state word "วินิบาต" (which ends in
// "นิบาต") from being mistaken for an Aṅguttara "นิบาต" section title — the bug
// that mislabeled hundreds of chunks on the live volume-1 data.
const TITLE_KEYWORDS =
  /(กัณฑ์|สิกขาบท|วิภังค์|บทภาชนีย์|ภาณวาร|ขันธกะ|นิทเทส|ปัณณาสก์|สูตร|วรรค|(?<!วิ)นิบาต)/;
const TITLE_PREFIX = /^เรื่อง.+/;
const MAX_TITLE_LEN = 40; // titles are short headings; body lines are longer
const ITEM_RE = /(?:^|\n)\s*(?:\[\s*([๐-๙\d]+)\s*\]|ข้อ\s*([๐-๙\d]+)|([๐-๙]+)\s*\.)\s*/g;

function isTitleLine(raw) {
  const t = raw.trim();
  const L = Array.from(t).length;
  if (!t || L > MAX_TITLE_LEN) return false;
  if (/^[๐-๙\d]/.test(t)) return false; // leading number ⇒ it's an item, not a title
  return TITLE_PREFIX.test(t) || TITLE_KEYWORDS.test(t);
}

// Strip end-of-section markers ("...๒- จบ.", "...จบ.") and collapse spaces.
function normalizeTitle(raw) {
  return raw
    .trim()
    .replace(/\s*[๐-๙\d]*[-.]?\s*จบ\.?\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function segmentSuttas(bodyText, { volumeTitle } = {}) {
  const text = clean(bodyText);
  if (!text) return [];

  // Find item boundaries.
  const marks = [];
  let m;
  while ((m = ITEM_RE.exec(text)) !== null) {
    const num = m[1] || m[2] || m[3];
    marks.push({ index: m.index, end: ITEM_RE.lastIndex, num: thaiToArabic(num) });
  }

  // No numbered items detected → return the whole page as a single section.
  if (marks.length === 0) {
    return [{ suttaName: volumeTitle || 'unknown', suttaNumber: null, pageRef: null, text }];
  }

  // Precompute title positions once (sorted by offset) → O(n) lookups.
  const titlePositions = [];
  {
    let acc = 0;
    for (const ln of text.split('\n')) {
      if (isTitleLine(ln)) titlePositions.push({ offset: acc, title: normalizeTitle(ln) });
      acc += ln.length + 1;
    }
  }
  function titleBefore(offset) {
    let title = volumeTitle || null;
    for (const tp of titlePositions) {
      if (tp.offset > offset) break;
      if (tp.title) title = tp.title;
    }
    return title;
  }

  const sections = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].end;
    const stop = i + 1 < marks.length ? marks[i + 1].index : text.length;
    const body = clean(text.slice(start, stop));
    if (!body) continue;
    sections.push({
      suttaName: titleBefore(marks[i].index) || volumeTitle || 'unknown',
      suttaNumber: marks[i].num,
      pageRef: null, // filled by ingest from A/Z offsets when available
      text: body,
    });
  }
  return sections;
}
