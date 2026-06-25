import { config } from '../config.js';
import { claude } from '../llm/claude.js';
import { smartRetrieve, uniqueCitations } from './retrieve.js';
import { classifyUniversalQuestion, buildUniversalSystem, VALID_TONES, DEFAULT_TONE } from './universal.js';

const SYSTEM_RULES = `คุณคือผู้ช่วยศึกษาพระธรรมที่มีความรู้ลึกในพระไตรปิฎกภาษาไทย ฉบับสยามรัฐ 45 เล่ม

กฎที่ต้องปฏิบัติเคร่งครัด:
1. ตอบจากเนื้อหาที่ได้รับมาเท่านั้น ห้าม hallucinate หรือแต่งพระสูตรขึ้นเอง
2. ทุกคำตอบต้องระบุแหล่งที่มาในรูปแบบ: [พระไตรปิฎก เล่มที่ X — ชื่อนิกาย — ชื่อพระสูตร ข้อ Y]
3. ถ้าไม่พบข้อมูลในเนื้อหาที่ได้รับ ให้บอกตรงๆ ว่า "ไม่พบข้อมูลในส่วนที่ค้นได้ กรุณาถามพระอาจารย์หรือผู้รู้โดยตรงค่ะ"
4. ตอบด้วยภาษาไทยที่เข้าใจง่าย อธิบายศัพท์บาลีเมื่อจำเป็น
5. ไม่ตีความเกินเนื้อหาที่มี ไม่ผสมคำสอนจากสำนักอื่นโดยไม่แจ้ง
6. ปิดท้ายทุกคำตอบด้วยการเตือนว่าการปฏิบัติจริงควรอยู่ภายใต้การแนะนำของครูอาจารย์`;

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
// opts.tone ∈ general | dhamma (default general) changes style only.
export async function ask(question, { tone, ...retrieveOpts } = {}) {
  const activeTone = VALID_TONES.includes(tone) ? tone : DEFAULT_TONE;

  // Phase 11 — classify (category + Dhamma angle + story detection), then search
  // the Tipitaka by the DHAMMA ANGLE rather than the surface words. e.g.
  // "ดาวเคราะห์เกิดได้ยังไง" → search "อนิจจัง ปฏิจจสมุปบาท".
  const cls = await classifyUniversalQuestion(question);
  const searchText = cls.dhamma_angle || question;
  const { chunks, confidence, topScore, retrieved, stats } = await smartRetrieve(searchText, retrieveOpts);

  // Genuinely relevant scripture? (0.5 calibrated to voyage's Thai score range,
  // not the spec's 0.65 which would almost never trigger.)
  const hasDirectSource = topScore != null && topScore >= 0.5 && chunks.length > 0;

  // Only surface citations/sources when the source is actually relevant — never
  // force a citation onto an unrelated question.
  const citations = hasDirectSource ? uniqueCitations(chunks) : [];
  const sources = hasDirectSource
    ? chunks.map((c) => ({
        volume: c.volume,
        pitaka: c.pitaka,
        nikaya: c.nikaya || null,
        sutta_name: c.sutta_name,
        sutta_number: c.sutta_number || null,
        score: c.score,
        text: c.text,
      }))
    : [];
  const context = hasDirectSource ? buildContext(chunks) : '';

  const category = cls.mode === 'story' ? 'story' : cls.category;
  const system = buildUniversalSystem({ category, tone: activeTone, context, hasDirectSource });

  const base = {
    mode: cls.mode === 'story' ? 'story_mode' : 'universal_mode',
    category,
    dhamma_angle: cls.dhamma_angle,
    has_direct_source: hasDirectSource,
    citations,
    sources,
    retrieved_chunks: hasDirectSource ? retrieved : 0,
    confidence: hasDirectSource ? confidence : 'low',
    top_score: topScore,
    tone: activeTone,
    retrieval_stats: stats,
  };

  let msg;
  try {
    msg = await claude().messages.create({
      model: config.rag.model,
      max_tokens: 2000, // universal/story answers run long; 1500 cut them mid-sentence
      system,
      messages: [{ role: 'user', content: question }],
    });
  } catch (e) {
    // Anthropic overloaded (529) / rate-limited (429) / transient 5xx, even after
    // retries → degrade gracefully so the user never sees a scary error.
    const status = e?.status;
    if (status === 429 || status === 529 || (status >= 500 && status < 600) || !status) {
      return {
        ...base,
        answer:
          'ขณะนี้ระบบ AI มีผู้ใช้งานจำนวนมาก ทำให้ยังตอบไม่ได้ชั่วคราว กรุณาลองถามใหม่อีกครั้งในอีกสักครู่ค่ะ 🙏' +
          (hasDirectSource
            ? '\n\nระหว่างนี้สามารถอ่านข้อความต้นฉบับจากพระไตรปิฎกที่ระบบค้นพบได้ที่ "🔍 ข้อความต้นฉบับ" ด้านล่างค่ะ\n\n' +
              citationBlock(citations)
            : ''),
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

  // Append the structured citation block only for the dhamma tone (the general
  // tone uses simple inline citations per its systemInstruction).
  if (hasDirectSource && activeTone === 'dhamma' && !answer.includes('📚 อ้างอิง')) {
    answer += `\n\n${citationBlock(citations)}`;
  }

  return { ...base, answer };
}
