import { config } from '../config.js';
import { claude, textOf, parseJsonLoose } from '../llm/claude.js';
import { crossRefLookup } from '../store/qdrant.js';

// Phase 9B.1 — extract structured cross-reference metadata from a chunk's text.
// Run ONCE during ingestion (no per-query cost). Always returns a safe shape.
export async function extractCrossRefs(text) {
  try {
    const r = await claude().messages.create({
      model: config.rag.model,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content:
            `วิเคราะห์เนื้อหาพระสูตรต่อไปนี้แล้วตอบเป็น JSON เท่านั้น:\n\n` +
            `เนื้อหา:\n"${(text || '').substring(0, 800)}"\n\n` +
            `สกัดข้อมูลต่อไปนี้:\n` +
            `{\n` +
            `  "topics": ["หัวข้อธรรมะหลัก 2-4 อย่าง"],\n` +
            `  "pali_terms": ["ศัพท์บาลีสำคัญที่ปรากฏ"],\n` +
            `  "explicit_refs": ["ชื่อสูตรหรือบทที่อ้างถึงโดยตรงในเนื้อหา"],\n` +
            `  "teaching_type": "หมวดใดใน: ศีล/สมาธิ/ปัญญา/วินัย/อภิธรรม"\n` +
            `}\n\nตอบ JSON เท่านั้น ถ้าไม่มีข้อมูลใดให้ใส่ array ว่าง []`,
        },
      ],
    });
    const p = parseJsonLoose(textOf(r));
    return {
      topics: Array.isArray(p.topics) ? p.topics : [],
      pali_terms: Array.isArray(p.pali_terms) ? p.pali_terms : [],
      explicit_refs: Array.isArray(p.explicit_refs) ? p.explicit_refs : [],
      teaching_type: typeof p.teaching_type === 'string' ? p.teaching_type : '',
    };
  } catch {
    return { topics: [], pali_terms: [], explicit_refs: [], teaching_type: '' };
  }
}

// Phase 9B.3 — expand top semantic results with chunks that they explicitly
// reference (via explicit_refs captured at ingestion). Marks added chunks with
// source: "cross_reference" for debugging. Capped at `max` total.
export async function expandWithCrossRefs(topResults, { max = 7 } = {}) {
  const out = [...topResults];
  const seen = new Set(topResults.map((r) => r.chunk_id || r.id));

  for (const r of topResults) {
    const refs = Array.isArray(r.explicit_refs) ? r.explicit_refs : [];
    for (const refName of refs) {
      if (out.length >= max) break;
      if (!refName || refName.length < 3) continue;
      const found = await crossRefLookup(refName, 1);
      for (const f of found) {
        const id = f.chunk_id;
        if (id && !seen.has(id)) {
          out.push({ ...f, source: 'cross_reference' });
          seen.add(id);
        }
      }
    }
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}
