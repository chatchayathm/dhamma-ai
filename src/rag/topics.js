import { config } from '../config.js';
import { claude, textOf, parseJsonLoose } from '../llm/claude.js';

// Map a Dhamma topic → which piṭaka / nikāya are most likely to contain it,
// plus Thai keywords for the fast classification path.
export const topicMap = {
  สมาธิ: {
    pitaka: ['สุตตันตปิฎก'],
    nikaya: ['ทีฆนิกาย', 'มัชฌิมนิกาย', 'อังคุตตรนิกาย'],
    keywords: ['สมาธิ', 'ฌาน', 'สมถะ', 'นิวรณ์', 'อัปปนา'],
  },
  สติ: {
    pitaka: ['สุตตันตปิฎก'],
    nikaya: ['มัชฌิมนิกาย', 'สังยุตตนิกาย'],
    keywords: ['สติ', 'วิปัสสนา', 'สติปัฏฐาน', 'กาย เวทนา จิต ธรรม'],
  },
  ศีล: {
    pitaka: ['วินัยปิฎก', 'สุตตันตปิฎก'],
    nikaya: ['ทีฆนิกาย'],
    keywords: ['ศีล', 'วินัย', 'สิกขาบท', 'ปาติโมกข์'],
  },
  ปัญญา: {
    pitaka: ['สุตตันตปิฎก', 'อภิธรรมปิฎก'],
    nikaya: ['สังยุตตนิกาย', 'มัชฌิมนิกาย'],
    keywords: ['ปัญญา', 'อนิจจัง', 'ทุกขัง', 'อนัตตา', 'ไตรลักษณ์'],
  },
  กิเลส: {
    pitaka: ['สุตตันตปิฎก', 'อภิธรรมปิฎก'],
    nikaya: ['อังคุตตรนิกาย', 'สังยุตตนิกาย'],
    keywords: ['โกรธ', 'โทสะ', 'โลภะ', 'โมหะ', 'กิเลส', 'ราคะ'],
  },
  อภิธรรม: {
    pitaka: ['อภิธรรมปิฎก'],
    nikaya: [],
    keywords: ['จิต', 'เจตสิก', 'รูป', 'นิพพาน', 'อภิธรรม'],
  },
};

// Classify a question into a topic. Fast path = keyword match; slow path = ask
// Claude. Returns { topic, confidence, filter }. On any error → "อื่นๆ".
export async function classifyQuestion(question) {
  for (const [topic, cfg] of Object.entries(topicMap)) {
    if (cfg.keywords.some((kw) => question.includes(kw))) {
      return { topic, confidence: 1, filter: cfg };
    }
  }
  try {
    const r = await claude().messages.create({
      model: config.rag.model,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content:
            `จากคำถามนี้: "${question}"\n` +
            `ระบุหมวดธรรมะหลักที่เกี่ยวข้องที่สุด 1 หมวด\n` +
            `เลือกจาก: สมาธิ, สติ, ศีล, ปัญญา, กิเลส, อภิธรรม, อื่นๆ\n` +
            `ตอบเป็น JSON: {"topic": "...", "confidence": 0.0-1.0}\n` +
            `ตอบ JSON เท่านั้น ไม่มีข้อความอื่น`,
        },
      ],
    });
    const parsed = parseJsonLoose(textOf(r));
    const topic = parsed.topic;
    return { topic, confidence: Number(parsed.confidence) || 0, filter: topicMap[topic] || null };
  } catch {
    return { topic: 'อื่นๆ', confidence: 0, filter: null };
  }
}

// Build a Qdrant `should` (OR) filter across the topic's piṭaka + nikāya.
export function buildTopicShouldFilter(cfg) {
  if (!cfg) return null;
  const should = [
    ...(cfg.pitaka || []).map((p) => ({ key: 'pitaka', match: { value: p } })),
    ...(cfg.nikaya || []).map((n) => ({ key: 'nikaya', match: { value: n } })),
  ];
  return should.length ? { should } : null;
}
