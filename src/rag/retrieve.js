import { config } from '../config.js';
import { embedQuery } from '../embed/embedder.js';
import { searchVectors } from '../store/qdrant.js';

// Map the top similarity score to a confidence label. Calibrated to
// voyage-multilingual-2's Thai cosine range (~0.4–0.6 for relevant matches).
export function scoreConfidence(topScore) {
  if (topScore == null) return 'not_found';
  if (topScore >= 0.6) return 'high';
  if (topScore >= 0.5) return 'medium';
  return 'low';
}

// Retrieve and re-rank context for a question.
//   1. embed the question (query input_type)
//   2. over-fetch from Qdrant above the score floor
//   3. drop tiny heading-only chunks (noise), then keep top-K
//   4. return chunks (sorted desc by score) + confidence
export async function retrieve(question, { topK = config.rag.topK, minScore = config.rag.minScore } = {}) {
  const vector = await embedQuery(question);
  // Over-fetch so dropping tiny fragments doesn't starve the result set.
  const raw = await searchVectors(vector, { topK: topK * 4, scoreThreshold: minScore });
  const hits = raw
    .filter((h) => Array.from(h.text || '').length >= config.rag.minChunkChars)
    .slice(0, topK);

  const topScore = hits.length ? hits[0].score : null;
  const confidence = hits.length ? scoreConfidence(topScore) : 'not_found';

  // Trim total context to a char budget so we don't overflow the prompt.
  let used = 0;
  const chunks = [];
  for (const h of hits) {
    const len = Array.from(h.text || '').length;
    if (used + len > config.rag.maxContextChars && chunks.length) break;
    used += len;
    chunks.push(h);
  }

  return { question, chunks, topScore, confidence, retrieved: chunks.length };
}

// Format a citation object from a chunk's payload.
export function toCitation(c) {
  return {
    volume: c.volume,
    pitaka: c.pitaka,
    nikaya: c.nikaya || null,
    sutta_name: c.sutta_name,
    sutta_number: c.sutta_number || null,
  };
}

// Dedupe citations by volume+sutta so the same sutta isn't listed twice.
export function uniqueCitations(chunks) {
  const seen = new Map();
  for (const c of chunks) {
    const key = `${c.volume}|${c.sutta_name}|${c.sutta_number}`;
    if (!seen.has(key)) seen.set(key, toCitation(c));
  }
  return [...seen.values()];
}
