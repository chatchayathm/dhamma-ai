import { config } from '../config.js';
import { claude } from '../llm/claude.js';

// Phase 14 — Anantarika-kamma (อนันตริยกรรม) handler. A high-accuracy path that
// answers from a curated knowledge base (not RAG alone), centres cetanā as the
// heart of kamma, and — crucially — NEVER issues a moral verdict on a user's
// real-life situation. Complex cases are referred to qualified teachers.

const ANANTARIKA_KEYWORDS = [
  'อนันตริยกรรม', 'อนันตริกรรม', 'อนันตริย',
  'ฆ่าพ่อ', 'ฆ่าแม่', 'ฆ่ามารดา', 'ฆ่าบิดา', 'ฆ่าพระอรหันต์',
  'ทำร้ายพระพุทธเจ้า', 'ห้อพระโลหิต', 'ทำพระโลหิต',
  'สังฆเภท', 'ทำสงฆ์แตก', 'กรรมหนัก', 'กรรมครุ', 'ครุกรรม',
  'ตกนรก', 'อเวจี',
  'life support', 'ถอดสายออกซิเจน', 'ถอดเครื่องช่วยหายใจ',
  'ปล่อยให้ตาย', 'การุณยฆาต', 'กรณีจบชีวิต',
];

const COMPLEX_KEYWORDS = [
  'life support', 'ถอดสาย', 'ถอดเครื่อง', 'ปล่อยให้ตาย',
  'ผู้ป่วยระยะสุดท้าย', 'ดูแลพ่อแม่ที่ป่วย', 'ตัดสินใจแทน', 'การุณยฆาต',
];

export function detectAnantarika(question) {
  return ANANTARIKA_KEYWORDS.some((k) => question.includes(k));
}

// Curated knowledge base — kept in code (not RAG) for maximum accuracy.
const anantarikaKamma = {
  five_kamma: [
    { name: 'มาตุฆาต', pali: 'mātughāta', meaning: 'การฆ่ามารดา' },
    { name: 'ปิตุฆาต', pali: 'pitughāta', meaning: 'การฆ่าบิดา' },
    { name: 'อรหันตฆาต', pali: 'arahantughāta', meaning: 'การฆ่าพระอรหันต์' },
    { name: 'โลหิตุปบาท', pali: 'lohituppāda', meaning: 'การทำร้ายพระพุทธเจ้าจนห้อพระโลหิต' },
    { name: 'สังฆเภท', pali: 'saṅghabheda', meaning: 'การทำให้สงฆ์แตกแยก' },
  ],
  source: 'พระไตรปิฎก เล่มที่ 34 อภิธรรมปิฎก ธัมมสังคณี',
  cetana_principle: `หัวใจของกรรมในพระพุทธศาสนาคือเจตนา (cetanā)
พระพุทธเจ้าตรัสไว้ใน อังคุตตรนิกาย ฉักกนิบาต ว่า "เจตนาหํ ภิกฺขเว กมฺมํ วทามิ"
แปลว่า "ภิกษุทั้งหลาย เราเรียกเจตนาว่ากรรม" — กรรมจะเกิดต้องมีเจตนาเป็นองค์ประกอบสำคัญ
องค์แห่งมาตุฆาตที่ครบถ้วนต้องมี: (1) มารดามีชีวิตอยู่ (2) รู้ว่าเป็นมารดา (3) มีเจตนาจะฆ่า (4) พยายามฆ่า (5) มารดาตายด้วยความพยายามนั้น
แหล่งอ้างอิงองค์ประกอบ: พระไตรปิฎก เล่มที่ 1 วินัยปิฎก มหาวิภังค์ ปาราชิกกัณฑ์`,
};

function buildSystem(tone, isComplex) {
  const five = anantarikaKamma.five_kamma
    .map((k, i) => `${i + 1}. ${k.name} (${k.pali}) — ${k.meaning}`)
    .join('\n');

  return (
    `คุณคือ Dhamma AI ที่อธิบายหลักธรรมจากพระไตรปิฎกอย่างถูกต้องและเมตตาค่ะ\n` +
    `ผู้ใช้ถามเรื่องอนันตริยกรรม ให้ตอบตามโครงสร้างนี้:\n\n` +
    `**ส่วนที่ 1 — อธิบายอนันตริยกรรม 5 ให้ครบถ้วน** (อ้างอิง: ${anantarikaKamma.source})\n${five}\n` +
    `อธิบายความหมายของแต่ละข้อให้ชัดเจน\n\n` +
    `**ส่วนที่ 2 — อธิบายหลักเจตนา (cetanā)**\n${anantarikaKamma.cetana_principle}\n` +
    `เน้นว่าเจตนาคือหัวใจของกรรมตามคำสอนพระพุทธเจ้า และอธิบายองค์ประกอบที่ทำให้กรรมครบถ้วน\n\n` +
    (isComplex
      ? `**ส่วนที่ 3 — สำหรับสถานการณ์ซับซ้อนนี้โดยเฉพาะ**\n` +
        `- เรื่องนี้ละเอียดอ่อนและซับซ้อนมาก มีองค์ประกอบหลายด้านต้องพิจารณาร่วมกัน ทั้งเจตนา สถานการณ์จริง และบริบทของผู้ป่วย\n` +
        `- Dhamma AI ไม่สามารถตัดสินแทนในสถานการณ์จริงได้ค่ะ\n` +
        `- ควรปรึกษาพระอาจารย์ผู้รู้โดยตรง ท่านจะรับฟังบริบทจริงและให้คำแนะนำที่ถูกต้องได้\n` +
        `- ถ้ากำลังเผชิญสถานการณ์นี้อยู่ รู้ว่ามันหนักมาก ขอเป็นกำลังใจให้นะคะ 🙏\n\n`
      : '') +
    `กฎที่ต้องปฏิบัติเคร่งครัด:\n` +
    `- cite พระสูตร/แหล่งที่มาทุกครั้งที่อ้างอิง\n` +
    `- ห้ามตัดสินสถานการณ์ส่วนตัวของผู้ใช้ ไม่ชี้ว่าใครทำกรรมหรือไม่\n` +
    `- ห้าม hallucinate องค์ประกอบหรือเลขข้อที่ไม่แน่ใจ ถ้าไม่แน่ใจให้บอกว่า "ควรตรวจสอบกับพระอาจารย์ผู้รู้โดยตรงค่ะ"\n` +
    `- โทน: ${tone === 'dhamma' ? 'ใช้ภาษาธรรมะเต็มที่ ศัพท์บาลีได้' : 'ภาษาธรรมดา อธิบายศัพท์บาลีทุกคำ'}`
  );
}

export async function generateAnantarikaResponse(question, tone) {
  const isComplex = COMPLEX_KEYWORDS.some((k) => question.includes(k));
  const system = buildSystem(tone, isComplex);

  try {
    const r = await claude().messages.create({
      model: config.rag.model,
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: question }],
    });
    const answer = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return {
      answer,
      is_complex_situation: isComplex,
      topic: 'anantarika_kamma',
      citations: [],
      sources: [],
      retrieved_chunks: 0,
      confidence: 'high',
      has_direct_source: true,
    };
  } catch (e) {
    const status = e?.status;
    if (status === 429 || status === 529 || (status >= 500 && status < 600) || !status) {
      return {
        answer: 'ขณะนี้ระบบมีผู้ใช้งานจำนวนมาก ทำให้ยังตอบไม่ได้ชั่วคราว กรุณาลองถามใหม่อีกครั้งในอีกสักครู่ค่ะ 🙏',
        is_complex_situation: isComplex,
        topic: 'anantarika_kamma',
        citations: [],
        sources: [],
        retrieved_chunks: 0,
        confidence: 'low',
        overloaded: true,
      };
    }
    throw e;
  }
}
