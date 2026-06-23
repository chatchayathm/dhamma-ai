import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';
import { config } from '../config.js';

// 84000.org serves legacy Thai pages. Older endpoints are TIS-620 (a.k.a.
// windows-874); some newer ones are UTF-8. We sniff the charset from the bytes
// and the <meta> tag, then decode deterministically. This is why a naive
// fetch().text() (which assumes UTF-8) returns garbled or empty Thai.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function detectCharset(buf) {
  const head = iconv.decode(buf.subarray(0, 2048), 'latin1').toLowerCase();
  if (/charset\s*=\s*["']?\s*(tis-?620|windows-?874|iso-?8859-?11)/.test(head)) {
    return 'win874';
  }
  if (/charset\s*=\s*["']?\s*utf-?8/.test(head)) return 'utf8';
  // Heuristic: valid UTF-8 Thai bytes start with 0xE0; TIS-620 Thai is 0xA1–0xFB.
  const hasUtf8Thai = buf.includes(0xe0);
  return hasUtf8Thai ? 'utf8' : 'win874';
}

export async function fetchHtml(url, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'DhammaAI-Ingest/0.1 (+research; contact founder)',
          Accept: 'text/html',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const charset = detectCharset(buf);
      const html = iconv.decode(buf, charset === 'win874' ? 'win874' : 'utf8');
      await sleep(config.source.delayMs); // be polite
      return { html, charset, url };
    } catch (err) {
      lastErr = err;
      await sleep(config.source.delayMs * attempt * 2);
    }
  }
  throw new Error(`fetchHtml failed after ${retries} tries: ${lastErr?.message}`);
}

// Build the reader URL for a whole volume. 84000.org uses character offsets
// (A = start, Z = end). Passing A=1 & a large Z returns the volume's pages;
// the site clamps Z to the real end, so an over-estimate is safe.
export function volumeReadUrl(B, A = 1, Z = 999999) {
  return `${config.source.baseUrl}/tipitaka/read/v.php?B=${B}&A=${A}&Z=${Z}`;
}

// Table-of-contents URL for a volume (used to enumerate suttas / ข้อ ranges).
export function volumeTocUrl(B) {
  return `${config.source.baseUrl}/tipitaka/read/?index_siri=${B}`;
}

// 84000's reader paginates by printed-book page (~142 source lines each). A
// single request with Z=999999 returns ONLY the first page — the rest must be
// reached by following the "หน้าถัดไป" (next-page) button, whose icon is
// go3.gif; the "หน้าสุดท้าย" (last) button is go4.gif. The href is a relative
// `?B=..&A=..&Z=..` URL. We walk next→next until we pass the last page.
const readBase = () => `${config.source.baseUrl}/tipitaka/read/v.php`;

function parseAZ(href = '') {
  const A = href.match(/[?&]A=(\d+)/);
  const Z = href.match(/[?&]Z=(\d+)/);
  return { A: A ? Number(A[1]) : null, Z: Z ? Number(Z[1]) : null };
}

// href of the <a> wrapping a given nav gif (go3 = next, go4 = last).
function navHref($, gif) {
  const img = $(`img[src*="${gif}"]`).first();
  if (!img.length) return null;
  const href = img.closest('a').attr('href');
  return href || null;
}

function toAbsolute(href) {
  if (!href) return null;
  if (/^https?:/i.test(href)) return href;
  if (href.startsWith('?')) return readBase() + href;
  return `${config.source.baseUrl}/tipitaka/read/${href.replace(/^\.?\//, '')}`;
}

// Fetch every page of a volume in reading order. Returns an array of decoded
// HTML strings (one per page). onPage(pageNo, A) is called for progress logging.
export async function fetchVolumePages(B, { maxPages = 5000, onPage } = {}) {
  const pages = [];
  const seenA = new Set();
  let url = volumeReadUrl(B); // page 1
  let curA = 1;
  let lastA = Infinity;

  for (let i = 0; i < maxPages; i++) {
    const { html } = await fetchHtml(url);
    pages.push(html);
    if (onPage) onPage(pages.length, curA);

    const $ = cheerio.load(html);
    const lastHref = navHref($, 'go4.gif');
    if (lastHref) {
      const { A } = parseAZ(lastHref);
      if (A != null) lastA = A;
    }
    if (curA >= lastA) break; // just fetched the last page

    const nextHref = navHref($, 'go3.gif');
    if (!nextHref) break; // no next button ⇒ done
    const { A: nextA } = parseAZ(nextHref);
    if (nextA == null || nextA <= curA || seenA.has(nextA)) break; // no progress ⇒ stop
    seenA.add(nextA);
    curA = nextA;
    url = toAbsolute(nextHref);
  }
  return pages;
}
