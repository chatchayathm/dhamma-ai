import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';

import { config } from './config.js';
import { VOLUMES, getVolume, parseVolumeArg } from './sources/volumes.js';
import { fetchVolumePages } from './sources/fetch84000.js';
import { extractBodyText, segmentSuttas } from './parse/parseSutta.js';
import { chunkVolume } from './chunk/chunker.js';
import { embedTexts, embedInfo } from './embed/embedder.js';
import { ensureCollection, upsertChunks } from './store/qdrant.js';

// ── CLI ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : def;
};
const DRY_RUN = flag('dry-run');
const DEMO = flag('demo');
const VOLS = parseVolumeArg(opt('volumes'));

const OUT_DIR = path.resolve('data/chunks');
const RAW_DIR = path.resolve('data/raw');
const SAMPLE_DIR = path.resolve('data/samples');

const log = (...a) => console.log(...a);
const banner = (t) => log(`\n${'─'.repeat(58)}\n${t}\n${'─'.repeat(58)}`);

// Load a volume's body text — from the live source, or from a bundled sample
// in --demo mode (lets you see the full pipeline output with no network).
async function loadBodyText(vol) {
  if (DEMO) {
    const p = path.join(SAMPLE_DIR, `vol-${vol.volume}.sample.txt`);
    if (!existsSync(p)) throw new Error(`No demo sample for volume ${vol.volume} at ${p}`);
    log(`  ↳ DEMO mode: reading sample ${path.relative(process.cwd(), p)}  (illustrative text, not canonical)`);
    return readFile(p, 'utf8');
  }
  log(`  ↳ fetching all pages for B=${vol.B} (following next-page links)…`);
  const pages = await fetchVolumePages(vol.B, {
    onPage: (n, a) => {
      if (n % 10 === 0 || n === 1) log(`     · page ${n} (line A=${a})`);
    },
  });
  log(`  ↳ fetched ${pages.length} page(s)`);
  if (!DRY_RUN) {
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(path.join(RAW_DIR, `vol-${vol.volume}.html`), pages.join('\n<!--PAGE-->\n'));
  }
  // Extract readable text per page, then join — keeps page chrome from bleeding
  // across page boundaries.
  return pages.map((h) => extractBodyText(h)).join('\n');
}

async function ingestVolume(vol) {
  banner(`เล่มที่ ${vol.volume} — ${vol.pitaka}${vol.nikaya ? ' / ' + vol.nikaya : ''} — ${vol.title}`);

  const body = await loadBodyText(vol);
  const sections = segmentSuttas(body, { volumeTitle: vol.title });
  log(`  ↳ parsed ${sections.length} sutta/section(s)`);

  const chunks = chunkVolume(sections, vol);
  log(`  ✓ เล่มที่ ${vol.volume}: ${chunks.length} chunk(s) from ${sections.length} section(s)`);

  // Persist chunks + metadata to JSON BEFORE embedding (Step 1.2 requirement).
  await mkdir(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, `vol-${vol.volume}.json`);
  await writeFile(jsonPath, JSON.stringify(chunks, null, 2));
  log(`  ✓ wrote ${path.relative(process.cwd(), jsonPath)}`);

  // Embed + upsert to Qdrant (skipped in dry-run).
  if (DRY_RUN) {
    log('  ⚠ dry-run: skipping embedding + Qdrant upsert');
    return { volume: vol.volume, sections: sections.length, chunks: chunks.length, upserted: 0 };
  }

  const { provider, dims } = embedInfo();
  log(`  ↳ embedding ${chunks.length} chunk(s) via ${provider} (${dims} dims)`);
  const vectors = await embedTexts(chunks.map((c) => c.text));
  const n = await upsertChunks(chunks, vectors);
  log(`  ✓ upserted ${n} point(s) to Qdrant collection "${config.qdrant.collection}"`);
  return { volume: vol.volume, sections: sections.length, chunks: chunks.length, upserted: n };
}

async function main() {
  banner('Dhamma AI — Tipitaka ingestion (Siam Rath, 45 vols)');
  log(`Mode      : ${DEMO ? 'DEMO ' : ''}${DRY_RUN ? 'DRY-RUN' : 'FULL'}`);
  log(`Embedding : ${embedInfo().provider} (${embedInfo().dims} dims)`);
  log(`Qdrant    : ${DRY_RUN ? '(skipped)' : config.qdrant.url + ' / ' + config.qdrant.collection}`);
  log(`Volumes   : ${VOLS.join(', ')}`);

  if (!DRY_RUN) await ensureCollection();

  const targets = VOLS.map(getVolume).filter(Boolean);
  if (targets.length !== VOLS.length) {
    log(`⚠ some requested volumes are out of range 1–45 and were skipped`);
  }

  const limit = pLimit(config.source.concurrency);
  const results = await Promise.all(targets.map((v) => limit(() => ingestVolume(v))));

  banner('SUMMARY');
  let totC = 0, totS = 0, totU = 0;
  for (const r of results) {
    totC += r.chunks; totS += r.sections; totU += r.upserted;
    log(`  เล่ม ${String(r.volume).padStart(2)} : ${String(r.sections).padStart(4)} sections  ${String(r.chunks).padStart(5)} chunks  ${String(r.upserted).padStart(5)} upserted`);
  }
  log(`  ${'─'.repeat(54)}`);
  log(`  TOTAL  : ${String(totS).padStart(4)} sections  ${String(totC).padStart(5)} chunks  ${String(totU).padStart(5)} upserted`);

  // Show a metadata sample (deliverable #2).
  if (results.length) {
    const first = results[0];
    const sample = JSON.parse(await readFile(path.join(OUT_DIR, `vol-${first.volume}.json`), 'utf8'));
    if (sample.length) {
      banner(`METADATA SAMPLE — เล่มที่ ${first.volume} (chunk 1 of ${sample.length})`);
      const s = sample[0];
      log(JSON.stringify({ id: s.id, metadata: s.metadata, text_preview: Array.from(s.text).slice(0, 160).join('') + '…' }, null, 2));
    }
  }
}

main().catch((e) => {
  console.error('\n✗ ingestion failed:', e.message);
  process.exit(1);
});
