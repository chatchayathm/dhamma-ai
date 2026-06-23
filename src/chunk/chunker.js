import { config } from '../config.js';

const len = (s) => Array.from(s).length; // count Unicode code points, not UTF-16 units

// Split overly-long text on natural Thai boundaries: paragraph breaks first,
// then phrase spaces (Thai separates phrases/sentences with spaces, not words).
function softSplit(text, maxChars) {
  const paras = text.split(/\n{2,}/).flatMap((p) => p.split('\n'));
  const pieces = [];
  for (const para of paras) {
    if (len(para) <= maxChars) {
      pieces.push(para);
    } else {
      // Break a giant paragraph at phrase spaces.
      let cur = '';
      for (const phrase of para.split(/(?<=\s)/)) {
        if (len(cur) + len(phrase) > maxChars && cur) {
          pieces.push(cur.trim());
          cur = '';
        }
        cur += phrase;
      }
      if (cur.trim()) pieces.push(cur.trim());
    }
  }
  return pieces.filter(Boolean);
}

// Greedily pack pieces into chunks up to maxChars, keeping a small overlap so a
// thought that straddles a boundary stays retrievable.
function pack(pieces, maxChars, overlap = 120) {
  const chunks = [];
  let cur = '';
  for (const piece of pieces) {
    if (len(cur) + len(piece) + 1 > maxChars && cur) {
      chunks.push(cur.trim());
      const tail = Array.from(cur).slice(-overlap).join('');
      cur = tail + '\n';
    }
    cur += piece + '\n';
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

// Turn parsed suttas into metadata-rich chunks.
//   sections: [{ suttaName, suttaNumber, pageRef, text }]
//   volume:   { volume, pitaka, nikaya, title }
// Returns: [{ id, text, metadata }]
export function chunkVolume(sections, volume, { maxChars = config.chunk.maxChars } = {}) {
  const chunks = [];
  for (const sec of sections) {
    const base = {
      volume: volume.volume,
      pitaka: volume.pitaka,
      nikaya: volume.nikaya,
      volume_title: volume.title,
      sutta_name: sec.suttaName,
      sutta_number: sec.suttaNumber,
      page_ref: sec.pageRef,
    };

    const parts =
      len(sec.text) <= maxChars ? [sec.text] : pack(softSplit(sec.text, maxChars), maxChars);

    parts.forEach((text, i) => {
      const id = [
        'v' + volume.volume,
        sec.suttaNumber ? 'n' + sec.suttaNumber : 's' + (chunks.length + 1),
        'p' + i,
      ].join('-');
      chunks.push({
        id,
        text,
        metadata: { ...base, chunk_index: i, chunk_of: parts.length, char_count: len(text) },
      });
    });
  }
  return chunks;
}
