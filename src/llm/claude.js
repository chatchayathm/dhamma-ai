import Anthropic from '@anthropic-ai/sdk';
import { Agent, fetch as undiciFetch } from 'undici';
import { config } from '../config.js';

// Render ⇄ api.anthropic.com keep-alive connections sometimes drop mid-request
// ("Premature close"): undici reuses a pooled socket the server already closed.
// Use a dispatcher with a very short keep-alive so a FRESH connection is opened
// each call, and pass it via a custom fetch (the npm-undici global dispatcher
// does NOT affect Node's built-in global fetch, so we must inject it directly).
const dispatcher = new Agent({
  keepAliveTimeout: 10, // ms — effectively no socket reuse
  keepAliveMaxTimeout: 10,
  connect: { timeout: 30_000 },
});
const resilientFetch = (url, opts = {}) => undiciFetch(url, { ...opts, dispatcher });

// Single shared Anthropic client used by answer generation, topic
// classification, and cross-reference extraction.
let _client;
export function claude() {
  if (!config.rag.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set in .env');
  if (!_client) {
    _client = new Anthropic({
      apiKey: config.rag.anthropicApiKey,
      fetch: resilientFetch, // fresh connection per request
      maxRetries: 6, // retry transient overload (529) + connection drops
      timeout: 60_000,
    });
  }
  return _client;
}

// Join the text blocks of a messages.create response.
export function textOf(msg) {
  return (msg?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

// Parse JSON that may be wrapped in prose or ```json fences.
export function parseJsonLoose(s) {
  const m = String(s).match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : s);
}
