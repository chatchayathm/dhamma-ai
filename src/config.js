import 'dotenv/config';

function pickProvider() {
  const forced = (process.env.EMBED_PROVIDER || '').toLowerCase();
  if (forced) return forced;
  if (process.env.VOYAGE_API_KEY) return 'voyage';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'mock';
}

export const config = {
  source: {
    baseUrl: process.env.SOURCE_BASE_URL || 'https://84000.org',
    concurrency: Number(process.env.FETCH_CONCURRENCY || 2),
    delayMs: Number(process.env.FETCH_DELAY_MS || 800),
  },
  chunk: {
    maxChars: Number(process.env.MAX_CHUNK_CHARS || 1500),
  },
  embed: {
    provider: pickProvider(),
    voyage: {
      apiKey: process.env.VOYAGE_API_KEY || '',
      model: process.env.VOYAGE_MODEL || 'voyage-multilingual-2',
      dims: 1024,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
      dims: 1536,
    },
    mock: { dims: 1024 },
  },
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY || undefined,
    collection: process.env.QDRANT_COLLECTION || 'tipitaka_siamrath',
  },
  rag: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    topK: Number(process.env.RAG_TOP_K || 5),
    // voyage-multilingual-2 cosine scores for Thai run ~0.4–0.6 even for strong
    // matches, so the floor is 0.40 (NOT 0.75 — that rejected everything).
    minScore: Number(process.env.RAG_MIN_SCORE || 0.4),
    minChunkChars: Number(process.env.RAG_MIN_CHUNK_CHARS || 25), // drop tiny heading fragments at query time
    maxContextChars: Number(process.env.RAG_MAX_CONTEXT || 6000),
  },
  api: {
    // Hosts like Render/Railway/Fly inject PORT — prefer it so deploys "just work".
    port: Number(process.env.PORT || process.env.API_PORT || 3001),
    corsOrigin: process.env.API_CORS_ORIGIN || '*',
  },
};

// Vector dimension depends on the active provider — used to create the collection.
export function activeDims() {
  return config.embed[config.embed.provider]?.dims ?? config.embed.mock.dims;
}
