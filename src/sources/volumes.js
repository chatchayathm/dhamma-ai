// Canonical map of the Thai Tipitaka — Siam Rath / Royal Thai 45-volume edition.
// pitaka: วินัยปิฎก | สุตตันตปิฎก | อภิธรรมปิฎก
// nikaya: applies to สุตตันตปิฎก only (null elsewhere)
//
// This map drives the ingestion loop. The `B` field is the book number used in
// 84000.org URLs (https://84000.org/tipitaka/read/v.php?B=<B>&A=<start>&Z=<end>),
// which matches the 45-volume numbering 1:1.

export const VOLUMES = [
  // ── วินัยปิฎก (เล่ม 1–8) ──────────────────────────────────────────
  { volume: 1,  B: 1,  pitaka: 'วินัยปิฎก', nikaya: null, title: 'มหาวิภังค์ ภาค 1' },
  { volume: 2,  B: 2,  pitaka: 'วินัยปิฎก', nikaya: null, title: 'มหาวิภังค์ ภาค 2' },
  { volume: 3,  B: 3,  pitaka: 'วินัยปิฎก', nikaya: null, title: 'ภิกขุนีวิภังค์' },
  { volume: 4,  B: 4,  pitaka: 'วินัยปิฎก', nikaya: null, title: 'มหาวรรค ภาค 1' },
  { volume: 5,  B: 5,  pitaka: 'วินัยปิฎก', nikaya: null, title: 'มหาวรรค ภาค 2' },
  { volume: 6,  B: 6,  pitaka: 'วินัยปิฎก', nikaya: null, title: 'จุลวรรค ภาค 1' },
  { volume: 7,  B: 7,  pitaka: 'วินัยปิฎก', nikaya: null, title: 'จุลวรรค ภาค 2' },
  { volume: 8,  B: 8,  pitaka: 'วินัยปิฎก', nikaya: null, title: 'ปริวาร' },

  // ── สุตตันตปิฎก (เล่ม 9–33) ───────────────────────────────────────
  // ทีฆนิกาย
  { volume: 9,  B: 9,  pitaka: 'สุตตันตปิฎก', nikaya: 'ทีฆนิกาย', title: 'สีลขันธวรรค' },
  { volume: 10, B: 10, pitaka: 'สุตตันตปิฎก', nikaya: 'ทีฆนิกาย', title: 'มหาวรรค' },
  { volume: 11, B: 11, pitaka: 'สุตตันตปิฎก', nikaya: 'ทีฆนิกาย', title: 'ปาฏิกวรรค' },
  // มัชฌิมนิกาย
  { volume: 12, B: 12, pitaka: 'สุตตันตปิฎก', nikaya: 'มัชฌิมนิกาย', title: 'มูลปัณณาสก์' },
  { volume: 13, B: 13, pitaka: 'สุตตันตปิฎก', nikaya: 'มัชฌิมนิกาย', title: 'มัชฌิมปัณณาสก์' },
  { volume: 14, B: 14, pitaka: 'สุตตันตปิฎก', nikaya: 'มัชฌิมนิกาย', title: 'อุปริปัณณาสก์' },
  // สังยุตตนิกาย
  { volume: 15, B: 15, pitaka: 'สุตตันตปิฎก', nikaya: 'สังยุตตนิกาย', title: 'สคาถวรรค' },
  { volume: 16, B: 16, pitaka: 'สุตตันตปิฎก', nikaya: 'สังยุตตนิกาย', title: 'นิทานวรรค' },
  { volume: 17, B: 17, pitaka: 'สุตตันตปิฎก', nikaya: 'สังยุตตนิกาย', title: 'ขันธวารวรรค' },
  { volume: 18, B: 18, pitaka: 'สุตตันตปิฎก', nikaya: 'สังยุตตนิกาย', title: 'สฬายตนวรรค' },
  { volume: 19, B: 19, pitaka: 'สุตตันตปิฎก', nikaya: 'สังยุตตนิกาย', title: 'มหาวารวรรค' },
  // อังคุตตรนิกาย
  { volume: 20, B: 20, pitaka: 'สุตตันตปิฎก', nikaya: 'อังคุตตรนิกาย', title: 'เอก-ทุก-ติกนิบาต' },
  { volume: 21, B: 21, pitaka: 'สุตตันตปิฎก', nikaya: 'อังคุตตรนิกาย', title: 'จตุกกนิบาต' },
  { volume: 22, B: 22, pitaka: 'สุตตันตปิฎก', nikaya: 'อังคุตตรนิกาย', title: 'ปัญจก-ฉักกนิบาต' },
  { volume: 23, B: 23, pitaka: 'สุตตันตปิฎก', nikaya: 'อังคุตตรนิกาย', title: 'สัตตก-อัฏฐก-นวกนิบาต' },
  { volume: 24, B: 24, pitaka: 'สุตตันตปิฎก', nikaya: 'อังคุตตรนิกาย', title: 'ทสก-เอกาทสกนิบาต' },
  // ขุททกนิกาย
  { volume: 25, B: 25, pitaka: 'สุตตันตปิฎก', nikaya: 'ขุททกนิกาย', title: 'ขุททกปาฐ-ธรรมบท-อุทาน-อิติวุตตก-สุตตนิบาต' },
  { volume: 26, B: 26, pitaka: 'สุตตันตปิฎก', nikaya: 'ขุททกนิกาย', title: 'วิมาน-เปต-เถร-เถรีคาถา' },
  { volume: 27, B: 27, pitaka: 'สุตตันตปิฎก', nikaya: 'ขุททกนิกาย', title: 'ชาดก ภาค 1' },
  { volume: 28, B: 28, pitaka: 'สุตตันตปิฎก', nikaya: 'ขุททกนิกาย', title: 'ชาดก ภาค 2' },
  { volume: 29, B: 29, pitaka: 'สุตตันตปิฎก', nikaya: 'ขุททกนิกาย', title: 'มหานิทเทส' },
  { volume: 30, B: 30, pitaka: 'สุตตันตปิฎก', nikaya: 'ขุททกนิกาย', title: 'จูฬนิทเทส' },
  { volume: 31, B: 31, pitaka: 'สุตตันตปิฎก', nikaya: 'ขุททกนิกาย', title: 'ปฏิสัมภิทามรรค' },
  { volume: 32, B: 32, pitaka: 'สุตตันตปิฎก', nikaya: 'ขุททกนิกาย', title: 'อปทาน ภาค 1' },
  { volume: 33, B: 33, pitaka: 'สุตตันตปิฎก', nikaya: 'ขุททกนิกาย', title: 'อปทาน ภาค 2 / พุทธวงศ์ / จริยาปิฎก' },

  // ── อภิธรรมปิฎก (เล่ม 34–45) ──────────────────────────────────────
  { volume: 34, B: 34, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'ธัมมสังคณี' },
  { volume: 35, B: 35, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'วิภังค์' },
  { volume: 36, B: 36, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'ธาตุกถา-ปุคคลบัญญัติ' },
  { volume: 37, B: 37, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'กถาวัตถุ' },
  { volume: 38, B: 38, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'ยมก ภาค 1' },
  { volume: 39, B: 39, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'ยมก ภาค 2' },
  { volume: 40, B: 40, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'ปัฏฐาน ภาค 1' },
  { volume: 41, B: 41, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'ปัฏฐาน ภาค 2' },
  { volume: 42, B: 42, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'ปัฏฐาน ภาค 3' },
  { volume: 43, B: 43, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'ปัฏฐาน ภาค 4' },
  { volume: 44, B: 44, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'ปัฏฐาน ภาค 5' },
  { volume: 45, B: 45, pitaka: 'อภิธรรมปิฎก', nikaya: null, title: 'ปัฏฐาน ภาค 6' },
];

export function getVolume(n) {
  return VOLUMES.find((v) => v.volume === Number(n));
}

// Parse a --volumes=1,9,34 or --volumes=9-11 CLI arg into an array of volume numbers.
export function parseVolumeArg(arg) {
  if (!arg) return VOLUMES.map((v) => v.volume);
  const out = new Set();
  for (const part of String(arg).split(',')) {
    const p = part.trim();
    if (p.includes('-')) {
      const [a, b] = p.split('-').map(Number);
      for (let i = a; i <= b; i++) out.add(i);
    } else if (p) {
      out.add(Number(p));
    }
  }
  return [...out].sort((a, b) => a - b);
}
