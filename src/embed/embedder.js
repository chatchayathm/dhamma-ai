import { config, activeDims } from '../config.js';

// Unified embedding interface. Provider is chosen in config (voyage > openai >
// mock). The mock embedder lets you exercise the whole pipeline — chunking,
// payload shape, Qdrant upsert — with NO API key, producing deterministic
// unit vectors so runs are reproducible. Swap in a real key to get real vectors.

async function embedVoyage(texts, inputType = 'document') {
  const { apiKey, model } = config.embed.voyage;
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    // input_type='query' for searches, 'document' for ingestion — Voyage tunes
    // the embedding asymmetrically, which improves retrieval relevance.
    body: JSON.stringify({ input: texts, model, input_type: inputType }),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

async function embedOpenAI(texts) {
  const { apiKey, model } = config.embed.openai;
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: texts, model }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

// Deterministic mock: hash text → seed → normalized vector. Same text ⇒ same vec.
function embedMock(texts) {
  const dims = config.embed.mock.dims;
  return texts.map((t) => {
    let seed = 2166136261;
    for (const ch of t) {
      seed ^= ch.codePointAt(0);
      seed = Math.imul(seed, 16777619) >>> 0;
    }
    const v = new Array(dims);
    let s = seed || 1;
    let norm = 0;
    for (let i = 0; i < dims; i++) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      const x = s / 0xffffffff - 0.5;
      v[i] = x;
      norm += x * x;
    }
    norm = Math.sqrt(norm) || 1;
    return v.map((x) => x / norm);
  });
}

const PROVIDERS = { voyage: embedVoyage, openai: embedOpenAI, mock: embedMock };

// Embed an array of texts in batches. Returns array of vectors aligned to input.
// inputType: 'document' (ingestion) or 'query' (search) — only Voyage uses it.
export async function embedTexts(texts, { batchSize = 64, inputType = 'document' } = {}) {
  const fn = PROVIDERS[config.embed.provider] || embedMock;
  const out = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    out.push(...(await fn(batch, inputType)));
  }
  return out;
}

// Convenience: embed a single query string → one vector.
export async function embedQuery(text) {
  const [v] = await embedTexts([text], { inputType: 'query' });
  return v;
}

export function embedInfo() {
  return { provider: config.embed.provider, dims: activeDims() };
}
