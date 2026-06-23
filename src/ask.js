import { ask } from './rag/answer.js';

// CLI: node src/ask.js "พระพุทธเจ้าตรัสเรื่องความอดทนไว้อย่างไร"
const question = process.argv.slice(2).join(' ').trim();
if (!question) {
  console.error('Usage: node src/ask.js "คำถามของคุณ"');
  process.exit(1);
}

const C = { dim: '\x1b[2m', b: '\x1b[1m', g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', x: '\x1b[0m' };
const confColor = { high: C.g, medium: C.y, low: C.r, not_found: C.r };

console.log(`\n${C.b}❓ ${question}${C.x}\n`);
const t0 = Date.now();
const res = await ask(question);

console.log(res.answer);
console.log(
  `\n${C.dim}— retrieved ${res.retrieved_chunks} chunk(s) · ` +
    `confidence: ${confColor[res.confidence] || ''}${res.confidence}${C.x}${C.dim}` +
    (res.top_score != null ? ` · top score ${res.top_score.toFixed(3)}` : '') +
    ` · ${((Date.now() - t0) / 1000).toFixed(1)}s${C.x}`,
);
