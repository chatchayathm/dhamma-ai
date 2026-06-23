// Thin client for the Phase 3 Express API.
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function http(path, opts) {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function askQuestion(question, { tone, session_id } = {}) {
  return http('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, tone, session_id }),
  });
}

export function listVolumes() {
  return http('/api/volumes');
}

export function browseVolume(volume) {
  return http(`/api/browse/${volume}`);
}

export function readChapter({ volume, sutta_number, sutta_name }) {
  const p = new URLSearchParams({ volume: String(volume), sutta_number: String(sutta_number) });
  if (sutta_name) p.set('sutta_name', sutta_name);
  return http(`/api/read?${p.toString()}`);
}

export function searchText({ q, pitaka, volume, limit = 20 }) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (pitaka) p.set('pitaka', pitaka);
  if (volume) p.set('volume', volume);
  p.set('limit', limit);
  return http(`/api/search?${p.toString()}`);
}

export function sendFeedback(payload) {
  return http('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
