import { config } from '../config.js';
import { claude, textOf, parseJsonLoose } from '../llm/claude.js';

// Phase 11 — Universal Dhamma. Every question (science, relationships, daily
// life, existential) has a Dhamma dimension. We classify the question, search
// the Tipitaka by its DHAMMA ANGLE (not the surface words), then answer through
// a category-appropriate lens — without distorting facts or faking citations.

export const CATEGORIES = [
  'dhamma_direct',
  'life_situation',
  'psychology_behavior',
  'science_nature',
  'society_world',
  'practical_life',
  'existential',
  'other',
];

// Per-category answering guidance injected into the system prompt.
const CATEGORY_PROMPTS = {
  dhamma_direct: `ตอบตรงๆ จากพระไตรปิฎกที่ได้รับมา อธิบายให้ชัดเจน มีตัวอย่างจากชีวิตจริงประกอบ`,
  life_situation: `เริ่มจากเข้าใจสถานการณ์ก่อน จากนั้นเชื่อมกับหลักธรรมที่เกี่ยวข้อง ไม่สั่งสอน แค่ชวนมองในมุมธรรมะ`,
  psychology_behavior: `อธิบายพฤติกรรมนั้นผ่านภาษาธรรมะ เช่น ผัดวันประกันพรุ่ง = ถีนมิทธะ + ขาดฉันทะ เชื่อมจิตวิทยาสมัยใหม่กับอภิธรรมได้ถ้าตรงกัน`,
  science_nature: `ตอบคำถามวิทยาศาสตร์ตามข้อเท็จจริงก่อน จากนั้นค่อยเชื่อมกับธรรมะในส่วนที่ overlap จริงๆ เช่น การเกิดดับของดาว → อนิจจัง ปฏิจจสมุปบาท ห้ามบิดเบือนวิทยาศาสตร์เพื่อให้เข้ากับธรรมะ ถ้าไม่มีจุดเชื่อมที่ honest ก็บอกตรงๆ`,
  society_world: `วิเคราะห์ปรากฏการณ์สังคมผ่านหลักธรรม เช่น สงคราม → โลภะ โทสะ โมหะในระดับรัฐ ไม่ตัดสินการเมือง แต่ชวนเห็นรากของปัญหาตามธรรม`,
  practical_life: `ให้คำแนะนำที่ทำได้จริง เชื่อมกับธรรมปฏิบัติ เช่น กินอาหาร → โภชเนมัตตัญญุตา การรู้จักประมาณในการกิน concrete มาก ไม่ลอยๆ`,
  existential: `คำถามเชิงชีวิตที่ลึกที่สุด ธรรมะตอบได้ดีที่สุด ให้เวลาและพื้นที่กับคำตอบนี้ อาจจบด้วยคำถามชวนคิดต่อ ไม่จำเป็นต้องให้คำตอบสุดท้าย`,
  story: `ผู้ใช้กำลังเล่าเรื่อง/ระบายความรู้สึก เริ่มจากรับฟังและเข้าใจความทุกข์ของเขาก่อนอย่างอ่อนโยน แล้วค่อยชวนมองผ่านมุมธรรมะ ไม่รีบสอน ไม่ตัดสิน`,
  other: `ตอบอย่างจริงใจ เชื่อมกับหลักธรรมที่เกี่ยวข้องถ้ามี`,
};

// Classify a question into a category + the Dhamma angle to search by, and
// detect whether it's a personal story/venting (folds in a light "story mode").
export async function classifyUniversalQuestion(question) {
  try {
    const r = await claude().messages.create({
      model: config.rag.model,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content:
            `จัดหมวดข้อความนี้แล้วตอบเป็น JSON เท่านั้น\n\nข้อความ: "${question}"\n\n` +
            `{\n` +
            `  "is_personal_story": true/false,  // เป็นการเล่าเรื่อง/ระบายความรู้สึกส่วนตัว ไม่ใช่คำถามตรงๆ\n` +
            `  "category": หนึ่งใน ["dhamma_direct","life_situation","psychology_behavior","science_nature","society_world","practical_life","existential","other"],\n` +
            `  "dhamma_angle": "มุมธรรมะที่น่าจะเชื่อมได้ เช่น อนิจจัง ปฏิจจสมุปบาท กิเลส ฉันทะ (คำค้นสำหรับหาในพระไตรปิฎก)",\n` +
            `  "tone_needed": "อธิบาย/ปลอบใจ/ชวนคิด/เชิงวิทยาศาสตร์"\n` +
            `}\n\nตอบ JSON เท่านั้น`,
        },
      ],
    });
    const p = parseJsonLoose(textOf(r));
    const category = CATEGORIES.includes(p.category) ? p.category : 'other';
    return {
      mode: p.is_personal_story ? 'story' : 'universal',
      category,
      dhamma_angle: typeof p.dhamma_angle === 'string' && p.dhamma_angle.trim() ? p.dhamma_angle.trim() : question,
      tone_needed: p.tone_needed || 'อธิบาย',
    };
  } catch {
    return { mode: 'universal', category: 'other', dhamma_angle: question, tone_needed: 'อธิบาย' };
  }
}

// Single source of truth for tones (Phase 13). Two tones only.
export const toneConfig = {
  general: {
    id: 'general',
    label: 'คนทั่วไป',
    icon: '🌿',
    description: 'ภาษาธรรมดา เข้าใจง่าย ไม่ต้องรู้ธรรมะมาก่อน',
    systemInstruction: `ใช้ภาษาไทยธรรมดาที่คนทั่วไปพูดกันค่ะ เหมือนเพื่อนที่รู้เรื่องธรรมะแล้วมาเล่าให้ฟังแบบเป็นกันเอง
- พูดตรงๆ เข้าใจง่าย ไม่ใช้ศัพท์บาลีโดยไม่อธิบาย
- ถ้าต้องใช้ศัพท์บาลี ให้วงเล็บความหมายไว้เสมอ เช่น "โทสะ (ความโกรธ)" ไม่ใช่แค่ "โทสะ"
- ใช้ตัวอย่างจากชีวิตประจำวันที่จับต้องได้
- ใช้แค่ "พระพุทธเจ้าสอนว่า..." ไม่ใช้ "พระผู้มีพระภาคตรัสว่า..."
- citation แบบเรียบง่าย เช่น "(จาก มหาสติปัฏฐานสูตร)"`,
    citationFormat: '(จาก {sutta_name})',
  },
  dhamma: {
    id: 'dhamma',
    label: 'สายธรรมะ',
    icon: '🪷',
    description: 'ภาษาธรรมะ อ้างอิงพระสูตร เหมาะกับผู้ปฏิบัติ',
    systemInstruction: `ใช้ภาษาธรรมะที่ผู้ปฏิบัติคุ้นเคยค่ะ อ้างอิงพระสูตรได้เต็มที่ ใช้ศัพท์บาลีได้โดยไม่ต้องอธิบายทุกคำ
- ใช้ศัพท์บาลีได้ตามปกติ เช่น ขันธ์ อายตนะ วิปัสสนา
- อ้างอิงพระสูตรแบบเต็ม เช่น "ใน มหาสติปัฏฐานสูตร ทีฆนิกาย มหาวรรค..."
- เชื่อมกับการปฏิบัติได้เลย
- citation แบบเต็ม เช่น "[พระไตรปิฎก เล่มที่ 10 — ทีฆนิกาย — มหาสติปัฏฐานสูตร ข้อ 273]"`,
    citationFormat: '[พระไตรปิฎก เล่มที่ {volume} — {nikaya} — {sutta_name} ข้อ {sutta_number}]',
  },
};
export const VALID_TONES = Object.keys(toneConfig);
export const DEFAULT_TONE = 'general';

// Build the universal-mode system prompt. Relaxes "answer only from scripture"
// (so any question can get a Dhamma-lens answer) but KEEPS the hard rule against
// fabricating citations or distorting facts.
export function buildUniversalSystem({ category, tone, context, hasDirectSource }) {
  const guide = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.other;
  const toneLine = (toneConfig[tone] || toneConfig[DEFAULT_TONE]).systemInstruction;
  const sourceBlock = context
    ? `เนื้อหาจากพระไตรปิฎก (ใช้เฉพาะที่เกี่ยวข้องจริงๆ):\n${context}`
    : `(ไม่พบพระสูตรที่ตรงกับคำถามนี้โดยตรง)`;

  return (
    `คุณคือ Dhamma AI ที่เชื่อว่า "ธรรมะคือธรรมชาติ" ทุกคำถามมีมิติทางธรรมะ ไม่ว่าจะเป็นวิทยาศาสตร์ ความสัมพันธ์ สังคม หรือชีวิตประจำวัน\n\n` +
    `หลักการตอบสำหรับคำถามประเภทนี้:\n${guide}\n\n` +
    `โทนการสื่อสาร: ${toneLine}\n\n` +
    `${sourceBlock}\n\n` +
    `กฎสำคัญที่ห้ามฝ่าฝืน:\n` +
    `- ห้าม hallucinate ชื่อพระสูตรหรือเลขข้อ เด็ดขาด อ้างได้เฉพาะพระสูตรที่ได้รับมาข้างบนเท่านั้น\n` +
    `- ถ้าพระสูตรในมือไม่ตรงกับคำถาม อย่าฝืน cite ให้ตอบจากหลักธรรมทั่วไปที่รู้จริง โดยขึ้นต้นว่า "หลักธรรมที่เกี่ยวข้องกับเรื่องนี้คือ..." และไม่อ้างเลขข้อ/ชื่อสูตรที่ไม่แน่ใจ\n` +
    `- ถ้าเป็นคำถามวิทยาศาสตร์ ต้องตอบข้อเท็จจริงทางวิทยาศาสตร์ให้ถูกต้องก่อน ห้ามบิดเบือนวิทยาศาสตร์เพื่อให้เข้ากับธรรมะ มุมธรรมะเป็นการ "ชวนมองเพิ่ม" ไม่ใช่แทนที่\n` +
    `- ไม่ตัดสิน ไม่สั่งสอน ไม่ครอบงำความเชื่อ\n` +
    `- ${hasDirectSource ? 'ปิดท้ายด้วยการระบุแหล่งอ้างอิงพระสูตรที่ใช้จริง' : 'คำถามนี้ไม่มีพระสูตรตรงๆ จึงไม่ต้องใส่บล็อกอ้างอิงพระสูตร'}\n` +
    `- ปิดท้ายด้วยการเตือนสั้นๆ ว่าการปฏิบัติจริงควรอยู่ภายใต้การแนะนำของครูอาจารย์`
  );
}
