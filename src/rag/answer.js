import { config } from '../config.js';
import { claude } from '../llm/claude.js';
import { smartRetrieve, uniqueCitations } from './retrieve.js';

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
  friendly: `ใช้ภาษาพูดเป็นกันเอง สบายๆ เข้าถึงง่าย ใช้คำลงท้าย "นะ" "เลย" "จริงๆ" ได้
ห้ามใช้คำสรรพนามเรียกผู้ใช้ใดๆ เช่น "เพื่อน" "เธอ" "คุณ" "ท่าน" — เขียนแบบไม่ต้องเรียกหรือทักผู้ฟังโดยตรง พูดถึงเนื้อหาธรรมะไปเลย
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

// Main entry: question → grounded answer + citations + confidence.
// opts.tone ∈ friendly | formal | practitioner (default formal) changes style only.
export async function ask(question, { tone, ...retrieveOpts } = {}) {
  const activeTone = TONE_INSTRUCTIONS[tone] ? tone : DEFAULT_TONE;
  const { chunks, confidence, topScore, retrieved, stats } = await smartRetrieve(question, retrieveOpts);

  // No chunk cleared the floor → return the canned not-found response.
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
      retrieval_stats: stats,
    };
  }

  const citations = uniqueCitations(chunks);
  const context = buildContext(chunks);

  const system =
    `${SYSTEM_RULES}\n\n` +
    `รูปแบบการสื่อสาร (tone: ${activeTone}):\n${TONE_INSTRUCTIONS[activeTone]}\n\n` +
    `${TONE_IMMUTABLE_RULES}\n\n` +
    `เนื้อหาอ้างอิงจากพระไตรปิฎก:\n${context}`;

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

  let msg;
  try {
    msg = await claude().messages.create({
      model: config.rag.model,
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: `คำถามของผู้ใช้: ${question}` }],
    });
  } catch (e) {
    // Anthropic overloaded (529) / rate-limited (429) / transient 5xx, even after
    // retries → degrade gracefully: friendly message + the real scripture sources
    // so the user still gets value and no scary error.
    const status = e?.status;
    if (status === 429 || status === 529 || (status >= 500 && status < 600) || !status) {
      return {
        answer:
          'ขณะนี้ระบบ AI มีผู้ใช้งานจำนวนมาก ทำให้ยังตอบไม่ได้ชั่วคราว กรุณาลองถามใหม่อีกครั้งในอีกสักครู่ค่ะ 🙏\n\n' +
          'ระหว่างนี้ท่านสามารถอ่านข้อความต้นฉบับจากพระไตรปิฎกที่ระบบค้นพบได้ที่ "🔍 ข้อความต้นฉบับ" ด้านล่างค่ะ\n\n' +
          citationBlock(citations),
        citations,
        sources,
        retrieved_chunks: retrieved,
        confidence,
        top_score: topScore,
        tone: activeTone,
        retrieval_stats: stats,
        overloaded: true,
      };
    }
    throw e;
  }

  let answer = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  // Guarantee the structured citation block is present even if the model omits it.
  if (!answer.includes('📚 อ้างอิง')) {
    answer += `\n\n${citationBlock(citations)}`;
  }

  return {
    answer,
    citations,
    sources,
    retrieved_chunks: retrieved,
    confidence,
    top_score: topScore,
    tone: activeTone,
    retrieval_stats: stats,
  };
}
