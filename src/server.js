import express from 'express';
import cors from 'cors';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { config } from './config.js';
import { ask } from './rag/answer.js';
import { embedQuery } from './embed/embedder.js';
import { searchVectors, scrollByFilter, buildFilter, getVolumeChapters, getChunksFor } from './store/qdrant.js';
import { getVolume, VOLUMES } from './sources/volumes.js';

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(
  cors({
    origin: config.api.corsOrigin === '*' ? true : config.api.corsOrigin.split(',').map((s) => s.trim()),
  }),
);

// Small async wrapper so thrown errors become 500s instead of crashing.
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(`✗ ${req.method} ${req.path}:`, e.message);
  res.status(500).json({ error: e.message });
});

// ── Health ────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, model: config.rag.model }));

// ── POST /api/ask ─────────────────────────────────────────────────
// Body: { question: string, session_id?: string, tone?: general|dhamma }
// Resp: { answer, citations[], sources[], retrieved_chunks, confidence, tone }
app.post(
  '/api/ask',
  wrap(async (req, res) => {
    const question = (req.body?.question || '').trim();
    if (!question) return res.status(400).json({ error: 'question is required' });
    const tone = ['general', 'dhamma'].includes(req.body?.tone) ? req.body.tone : 'general';
    const result = await ask(question, { tone });
    res.json({
      answer: result.answer,
      citations: result.citations,
      sources: result.sources,
      retrieved_chunks: result.retrieved_chunks,
      confidence: result.confidence,
      tone: result.tone,
      retrieval_stats: result.retrieval_stats,
      // Phase 11 — universal Dhamma
      mode: result.mode,
      category: result.category,
      dhamma_angle: result.dhamma_angle,
      has_direct_source: result.has_direct_source,
    });
  }),
);

// ── GET /api/search ───────────────────────────────────────────────
// Query: ?q=string&pitaka=string&volume=number&nikaya=string&limit=20
// Resp: { results: [chunk with metadata (+score when q given)] }
app.get(
  '/api/search',
  wrap(async (req, res) => {
    const { q, pitaka, volume, nikaya } = req.query;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const filter = buildFilter({ volume, pitaka, nikaya });

    let results;
    if (q && String(q).trim()) {
      // Semantic search (no score floor here — search should surface ranked
      // results even below the 0.75 answer-confidence threshold).
      const vector = await embedQuery(String(q).trim());
      results = await searchVectors(vector, { topK: limit, filter });
    } else if (filter) {
      const { points } = await scrollByFilter(filter, { limit });
      results = points;
    } else {
      return res.status(400).json({ error: 'provide q and/or a filter (pitaka, volume, nikaya)' });
    }
    res.json({ count: results.length, results });
  }),
);

// ── GET /api/browse/:volume ───────────────────────────────────────
// Resp: { volume_info, chapters: [{ sutta_name, sutta_number, chunks }] }
app.get(
  '/api/browse/:volume',
  wrap(async (req, res) => {
    const info = getVolume(req.params.volume);
    if (!info) return res.status(404).json({ error: `volume ${req.params.volume} not found (1–45)` });
    const { chapters, total_chunks } = await getVolumeChapters(info.volume);
    // Drop running-header noise: page headers equal to the volume title get
    // mis-detected as chapter titles. Hide those rows from the browse list.
    const cleaned = chapters.filter((c) => c.sutta_name && c.sutta_name !== info.title);
    res.json({ volume_info: { ...info, total_chunks }, chapters: cleaned });
  }),
);

// ── GET /api/read ─────────────────────────────────────────────────
// Query: ?volume=1&sutta_number=2&sutta_name=...(optional)
// Resp: { count, chunks: [{ sutta_name, sutta_number, chunk_index, text }] }
app.get(
  '/api/read',
  wrap(async (req, res) => {
    const { volume, sutta_number, sutta_name } = req.query;
    if (!volume || sutta_number == null || sutta_number === '') {
      return res.status(400).json({ error: 'volume and sutta_number are required' });
    }
    const chunks = await getChunksFor(volume, sutta_number, sutta_name);
    res.json({ count: chunks.length, chunks });
  }),
);

// List all 45 volumes (handy for the frontend browse menu).
app.get('/api/volumes', (_req, res) => res.json({ volumes: VOLUMES }));

// ── POST /api/feedback (Phase 5: human-review flag) ───────────────
// Logs a "this answer looks wrong" report. For the MVP we append to a local
// JSONL file; swap this for a Google Sheets append in Phase 5.
app.post(
  '/api/feedback',
  wrap(async (req, res) => {
    const { question, answer, reason, session_id } = req.body || {};
    if (!question) return res.status(400).json({ error: 'question is required' });
    const record = {
      ts: new Date().toISOString(),
      session_id: session_id || null,
      question,
      answer: answer || null,
      reason: reason || null,
    };
    const dir = path.resolve('data');
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, 'feedback.jsonl'), JSON.stringify(record) + '\n');
    res.json({ ok: true });
  }),
);

app.listen(config.api.port, () => {
  console.log(`🪷 Dhamma AI API listening on http://localhost:${config.api.port}`);
  console.log(`   POST /api/ask · GET /api/search · GET /api/browse/:volume · GET /api/read · GET /api/volumes · POST /api/feedback`);
});
