import { config } from '../config.js';
import { claude, textOf } from '../llm/claude.js';

// Words that signal a follow-up depending on earlier context.
const FOLLOWUP_HINTS = [
  'แล้ว', 'นั้น', 'ที่ว่า', 'อีก', 'เพิ่มเติม', 'ขยาย', 'อธิบายต่อ',
  'หมายความว่า', 'เกี่ยวกับที่', 'สอง', 'ทั้งสอง', 'อันนี้', 'เรื่องนี้', 'มันคือ',
];

// Phase 15 — turn a context-dependent follow-up ("แล้วสองอย่างนี้ต่างกันยังไง")
// into a STANDALONE search query ("ความต่างระหว่างอนิจจัง ทุกขัง") so Qdrant can
// actually find it. Self-contained questions are returned unchanged.
export async function buildContextualQuery(question, history = []) {
  if (!Array.isArray(history) || history.length === 0) return question;

  const needsContext =
    question.length < 20 ||
    FOLLOWUP_HINTS.some((k) => question.startsWith(k) || question.includes(k));
  if (!needsContext) return question;

  try {
    const r = await claude().messages.create({
      model: config.rag.model,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content:
            `บทสนทนาก่อนหน้า:\n` +
            history
              .slice(-4)
              .map((h) => `${h.role === 'user' ? 'ผู้ใช้' : 'AI'}: ${String(h.content).substring(0, 200)}`)
              .join('\n') +
            `\n\nคำถามปัจจุบัน: "${question}"\n\n` +
            `สร้าง search query ภาษาไทย 1 ประโยคที่ใช้ค้นหาในพระไตรปิฎกสำหรับคำถามนี้ โดยรวม context จากบทสนทนาด้วย ` +
            `ตอบแค่ query เท่านั้น ไม่มีข้อความอื่น`,
        },
      ],
    });
    const q = textOf(r).trim();
    return q || question;
  } catch {
    return question;
  }
}
