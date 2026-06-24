import { QdrantClient } from '@qdrant/js-client-rest';
import { createHash } from 'node:crypto';
import { config, activeDims } from '../config.js';

let _client;
export function client() {
  if (!_client) {
    _client = new QdrantClient({
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey,
      checkCompatibility: false, // client lib may be newer than the pinned server image; safe to skip
    });
  }
  return _client;
}

// Qdrant point IDs must be uint64 or UUID. Map our string chunk id → a
// deterministic UUID via md5 so re-ingesting the same chunk overwrites cleanly.
function pointId(stringId) {
  const h = createHash('md5').update(stringId).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join('-');
}

export async function ensureCollection() {
  const c = client();
  const name = config.qdrant.collection;
  const exists = await c.collectionExists(name).then((r) => r.exists).catch(() => false);
  if (!exists) {
    await c.createCollection(name, {
      vectors: { size: activeDims(), distance: 'Cosine' },
    });
    // Payload indexes for fast metadata filtering (browse/search endpoints).
    // volume is an integer — Qdrant Cloud rejects integer match() against a
    // keyword index, so it MUST be 'integer'. The rest are strings (keyword).
    const indexes = { volume: 'integer', pitaka: 'keyword', nikaya: 'keyword', sutta_number: 'keyword' };
    for (const [field, schema] of Object.entries(indexes)) {
      await c.createPayloadIndex(name, { field_name: field, field_schema: schema }).catch(() => {});
    }
  }
  return name;
}

// chunks: [{ id, text, metadata }], vectors: number[][] aligned to chunks.
// Upsert in batches — a single request with thousands of 1024-dim vectors + text
// payloads exceeds Qdrant's request size limit and returns "Bad Request".
export async function upsertChunks(chunks, vectors, { batchSize = 128 } = {}) {
  const c = client();
  const name = config.qdrant.collection;
  const points = chunks.map((ch, i) => ({
    id: pointId(ch.id),
    vector: vectors[i],
    payload: { chunk_id: ch.id, text: ch.text, ...ch.metadata },
  }));
  let done = 0;
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    await c.upsert(name, { wait: true, points: batch });
    done += batch.length;
  }
  return done;
}

// Vector search. queryVector → top-k points above scoreThreshold, with payload.
// `filter` is an optional Qdrant filter (e.g. by volume / pitaka) for /search.
export async function searchVectors(queryVector, { topK = 5, scoreThreshold, filter } = {}) {
  const c = client();
  const res = await c.search(config.qdrant.collection, {
    vector: queryVector,
    limit: topK,
    with_payload: true,
    score_threshold: scoreThreshold,
    filter,
  });
  return res.map((r) => ({ score: r.score, ...r.payload }));
}

// Scroll points by metadata filter (no vector) — backs /search and /browse.
export async function scrollByFilter(filter, { limit = 50, offset } = {}) {
  const c = client();
  const res = await c.scroll(config.qdrant.collection, {
    filter,
    limit,
    offset,
    with_payload: true,
    with_vector: false,
  });
  return { points: res.points.map((p) => p.payload), next: res.next_page_offset };
}

// Build a Qdrant metadata filter from optional volume / pitaka / nikaya.
export function buildFilter({ volume, pitaka, nikaya } = {}) {
  const must = [];
  if (volume != null && volume !== '') must.push({ key: 'volume', match: { value: Number(volume) } });
  if (pitaka) must.push({ key: 'pitaka', match: { value: pitaka } });
  if (nikaya) must.push({ key: 'nikaya', match: { value: nikaya } });
  return must.length ? { must } : undefined;
}

// List the suttas/chapters in a volume (for /browse). Scrolls the volume's
// points reading only the title fields, and aggregates distinct suttas with
// their chunk counts. Ordered by sutta number.
export async function getVolumeChapters(volume) {
  const c = client();
  const filter = { must: [{ key: 'volume', match: { value: Number(volume) } }] };
  const map = new Map();
  let offset;
  let total = 0;
  do {
    const res = await c.scroll(config.qdrant.collection, {
      filter,
      limit: 500,
      offset,
      with_payload: ['sutta_name', 'sutta_number'],
      with_vector: false,
    });
    for (const p of res.points) {
      total++;
      const key = `${p.payload.sutta_number}|${p.payload.sutta_name}`;
      const e = map.get(key) || {
        sutta_name: p.payload.sutta_name,
        sutta_number: p.payload.sutta_number,
        chunks: 0,
      };
      e.chunks++;
      map.set(key, e);
    }
    offset = res.next_page_offset;
  } while (offset);

  const chapters = [...map.values()].sort(
    (a, b) => (Number(a.sutta_number) || 0) - (Number(b.sutta_number) || 0),
  );
  return { chapters, total_chunks: total };
}

// Fetch the actual text chunks for one chapter (volume + ข้อ number, optionally
// pinned to a sutta_name), ordered for reading. Backs /api/read and the browse
// "click to read" view.
export async function getChunksFor(volume, suttaNumber, suttaName) {
  const c = client();
  // Filter only on indexed fields (volume=integer, sutta_number=keyword). Narrow
  // by sutta_name in JS afterwards so we never require an index on sutta_name
  // (which is reserved for the cross-ref full-text index).
  const must = [
    { key: 'volume', match: { value: Number(volume) } },
    { key: 'sutta_number', match: { value: String(suttaNumber) } },
  ];
  const res = await c.scroll(config.qdrant.collection, {
    filter: { must },
    limit: 500,
    with_payload: true,
    with_vector: false,
  });
  let points = res.points.map((p) => p.payload);
  if (suttaName) points = points.filter((p) => p.sutta_name === suttaName);
  return points.sort((a, b) => (a.chunk_index || 0) - (b.chunk_index || 0));
}

// Phase 9B: a full-text index on sutta_name lets cross-reference lookups match
// a referenced sutta by name. Idempotent — safe to call on every ingest.
export async function ensureCrossRefIndex() {
  const c = client();
  await c
    .createPayloadIndex(config.qdrant.collection, { field_name: 'sutta_name', field_schema: 'text' })
    .catch(() => {});
}

// Look up one chunk whose sutta_name matches a referenced name (full-text).
// Returns [] on any error (e.g. text index not present) so callers never break.
export async function crossRefLookup(refName, limit = 1) {
  try {
    const c = client();
    const res = await c.scroll(config.qdrant.collection, {
      filter: { must: [{ key: 'sutta_name', match: { text: refName } }] },
      limit,
      with_payload: true,
      with_vector: false,
    });
    return res.points.map((p) => p.payload);
  } catch {
    return [];
  }
}
