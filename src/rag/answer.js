import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { retrieve, uniqueCitations } from './retrieve.js';

const SYSTEM_RULES = `คุณคือผู้ช่วยศึกษาพระธรรมที่มีความรู้ลึกในพระไตรปิฎกภาษาไทย ฉบับสยามรัฐ 45 เล่ม

กฎที่ต้องปฏิบัติเคร่งครัด:
1. ตอบจากเนื้อหาที่ได้รับมาเท่านั้น ห้าม hallucinate หรือแต่งพระสูตรขึ้นเอง
2. ทุกคำตอบต้องระบุแหล่งที่มาในรูปแบบ: [พระไตรปิฎก เล่มที่ X — ชื่อนิกาย — ชื่อพระสูตร ข้อ Y]
3. ถ้าไม่พบข้อมูลในเนื้อหาที่ได้รับ ให้บอกตรงๆ ว่า "ไม่พบข้อมูลในส่วนที่ค้นได้ กรุณาถามพระอาจารย์หรือผู้รู้โดยตรงค่ะ"
4. ตอบด้วยภาษาไทยที่เข้าใจง่าย อธิบายศัพท์บาลีเมื่อจำเป็น
5. ไม่ตีความเกินเนื้อหาที่มี ไม่ผสมคำสอนจากสำนักอื่นโดยไม่แจ้ง
6. ปิดท้ายทุกคำตอบด้วยการเตือนว่าการปฏิบัติจริงควรอยู่ภายใต้การแนะนำของครูอาจารย์`;

// Tone / persona instructions — change the LANGUAGE STYLE only, never the
// content or citation accuracy. Default is "formal".
const TONE_INSTRUCTIONS = {
  friendly: `ใช้ภาษาพูดเป็นกันเอง เหมือนคุยกับเพื่อน
เรียกผู้ใช้ว่า "เพื่อน" หรือ "เธอ" ใช้คำลงท้าย "นะ" "เลย" "จริงๆ" ได้
อธิบายศัพท์บาลีด้วยตัวอย่างชีวิตประจำวัน ใช้ประโยคสั้น เข้าใจง่าย`,
  formal: `ใช้ภาษาสุภาพ เป็นทางการ จริงจัง
เรียกผู้ใช้ว่า "ท่าน" หรือ "คุณ"
ใช้ภาษาวิชาการพุทธศาสตร์ได้เต็มที่`,
  practitioner: `ใช้ภาษาสุภาพแบบผู้ปฏิบัติธรรม เน้นการนำไปปฏิบัติจริง
เชื่อมทุกคำสอนกับการปฏิบัติ — จิต สติ สมาธิ วิปัสสนา
ไม่ใช่แค่ทฤษฎี แต่ชี้ให้เห็นแนวทางปฏิบัติเสมอ`,
};
const DEFAULT_TONE = 'formal';

// Rules that are IDENTICAL across every tone — accuracy is never traded for style.
const TONE_IMMUTABLE_RULES = `กฎที่เปลี่ยนไม่ได้ไม่ว่าจะใช้ tone ใด:
- Citation ต้องแม่นยำเสมอ
- ถ้าไม่มีข้อมูล ต้องบอกตรงๆ ไม่มีข้อยกเว้น
- ห้าม hallucinate ชื่อพระสูตรหรือเลขข้อ
- ห้ามตีความเกินพระสูตรที่อ้างอิง`;

const NOT_FOUND_ANSWER =
  'ไม่พบข้อมูลในส่วนที่ค้นได้ กรุณาถามพระอาจารย์หรือผู้รู้โดยตรงค่ะ\n\n' +
  '📚 อ้างอิง: ไม่พบแหล่งอ้างอิงที่ชัดเจนในพระไตรปิฎกฉบับสยามรัฐสำหรับคำถามนี้';

// Render retrieved chunks with their metadata header for the prompt context.
function buildContext(chunks) {
  return chunks
    .map((c, i) => {
      const head = `[#${i + 1}] พระไตรปิฎก เล่มที่ ${c.volume} ${c.pitaka}` +
        (c.nikaya ? ` — ${c.nikaya}` : '') +
        ` — ${c.sutta_name}` +
        (c.sutta_number ? ` ข้อ ${c.sutta_number}` : '') +
        ` (ความใกล้เคียง ${c.score.toFixed(3)})`;
      return `${head}\n${c.text}`;
    })
    .join('\n\n---\n\n');
}

// Build the structured citation block required at the end of every answer.
function citationBlock(citations) {
  if (!citations.length) {
    return '📚 อ้างอิง: ไม่พบแหล่งอ้างอิงที่ชัดเจนในพระไตรปิฎกฉบับสยามรัฐสำหรับคำถามนี้';
  }
  const lines = citations.map(
    (c) =>
      `- พระไตรปิฎก เล่มที่ ${c.volume} ${c.pitaka}` +
      (c.nikaya ? ` — ${c.nikaya}` : '') +
      ` — ${c.sutta_name}` +
      (c.sutta_number ? ` ข้อ ${c.sutta_number}` : ''),
  );
  return `📚 อ้างอิง:\n${lines.join('\n')}`;
}

let _client;
function anthropic() {
  if (!config.rag.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set in .env');
  if (!_client) _client = new Anthropic({ apiKey: config.rag.anthropicApiKey });
  return _client;
}

// Main entry: question → grounded answer + citations + confidence.
// opts.tone ∈ friendly | formal | practitioner (default formal) changes style only.
export async function ask(question, { tone, ...retrieveOpts } = {}) {
  const activeTone = TONE_INSTRUCTIONS[tone] ? tone : DEFAULT_TONE;
  const { chunks, confidence, topScore, retrieved } = await retrieve(question, retrieveOpts);

  // No chunk cleared the 0.75 floor → return the canned not-found response.
  // We never call Claude here, so there is zero chance of a fabricated citation.
  if (!chunks.length) {
    return {
      answer: NOT_FOUND_ANSWER,
      citations: [],
      sources: [],
      retrieved_chunks: 0,
      confidence: 'not_found',
      top_score: topScore,
      tone: activeTone,
    };
  }

  const citations = uniqueCitations(chunks);
  const context = buildContext(chunks);

  const system =
    `${SYSTEM_RULES}\n\n` +
    `รูปแบบการสื่อสาร (tone: ${activeTone}):\n${TONE_INSTRUCTIONS[activeTone]}\n\n` +
    `${TONE_IMMUTABLE_RULES}\n\n` +
    `เนื้อหาอ้างอิงจากพระไตรปิฎก:\n${context}`;

  const msg = await anthropic().messages.create({
    model: config.rag.model,
    max_tokens: 1500,
    system,
    messages: [{ role: 'user', content: `คำถามของผู้ใช้: ${question}` }],
  });

  let answer = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  // Guarantee the structured citation block is present even if the model omits it.
  if (!answer.includes('📚 อ้างอิง')) {
    answer += `\n\n${citationBlock(citations)}`;
  }

  // Raw source chunks so the UI can show the actual scripture text (Phase 5:
  // let users verify, and separate original text from the AI's interpretation).
  const sources = chunks.map((c) => ({
    volume: c.volume,
    pitaka: c.pitaka,
    nikaya: c.nikaya || null,
    sutta_name: c.sutta_name,
    sutta_number: c.sutta_number || null,
    score: c.score,
    text: c.text,
  }));

  return {
    answer,
    citations,
    sources,
    retrieved_chunks: retrieved,
    confidence,
    top_score: topScore,
    tone: activeTone,
  };
}
