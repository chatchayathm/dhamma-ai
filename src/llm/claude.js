import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

// Single shared Anthropic client used by answer generation, topic
// classification, and cross-reference extraction.
let _client;
export function claude() {
  if (!config.rag.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set in .env');
  if (!_client) {
    _client = new Anthropic({
      apiKey: config.rag.anthropicApiKey,
      // Anthropic returns 529 "Overloaded" under load; the SDK retries with
      // exponential backoff. Bump retries so transient overload self-heals.
      maxRetries: 5,
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
