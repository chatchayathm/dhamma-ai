import { config } from '../config.js';
import { embedQuery } from '../embed/embedder.js';
import { searchVectors } from '../store/qdrant.js';
import { classifyQuestion, buildTopicShouldFilter } from './topics.js';
import { expandWithCrossRefs } from './crossrefs.js';

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

const sizeOf = (s) => Array.from(s || '').length;
const bigEnough = (h) => sizeOf(h.text) >= config.rag.minChunkChars;

// Phase 9 — smart retrieval: classify topic → filtered search (with broad
// fallback) → expand with cross-references. Returns chunks + retrieval_stats.
export async function smartRetrieve(
  question,
  { topK = config.rag.topK, minScore = config.rag.minScore } = {},
) {
  const vector = await embedQuery(question);
  const cls = await classifyQuestion(question);

  // Apply the topic filter only when we're confident in the classification.
  const useFilter = cls.topic && cls.topic !== 'อื่นๆ' && cls.confidence > 0.7;
  const filter = useFilter ? buildTopicShouldFilter(cls.filter) : null;

  let hits = [];
  let filterApplied = Boolean(filter);
  try {
    hits = (await searchVectors(vector, { topK: topK * 2, scoreThreshold: minScore, filter })).filter(bigEnough);
  } catch {
    // A missing/incompatible payload index would 400 here — fall through to broad.
    hits = [];
  }

  // Fallback: too few results under the filter (or it errored) → search broad.
  if (hits.length < 3) {
    hits = (await searchVectors(vector, { topK: topK * 2, scoreThreshold: minScore, filter: null })).filter(bigEnough);
    filterApplied = false;
  }

  const semantic = hits.slice(0, topK);
  // Expand with explicitly-referenced suttas (Phase 9B), then trim to a char budget.
  let expanded = await expandWithCrossRefs(semantic, { max: topK + 2 });
  let used = 0;
  const chunks = [];
  for (const c of expanded) {
    const len = sizeOf(c.text);
    if (used + len > config.rag.maxContextChars && chunks.length) break;
    used += len;
    chunks.push(c);
  }

  const topScore = semantic.length ? semantic[0].score : null;
  const confidence = semantic.length ? scoreConfidence(topScore) : 'not_found';
  return {
    question,
    chunks,
    topScore,
    confidence,
    retrieved: chunks.length,
    stats: {
      semantic_chunks: semantic.length,
      crossref_chunks: chunks.filter((c) => c.source === 'cross_reference').length,
      topic_classified: cls.topic,
      topic_confidence: cls.confidence,
      filter_applied: filterApplied,
    },
  };
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
