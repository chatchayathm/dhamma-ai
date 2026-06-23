# Dhamma AI — Data Ingestion (Phase 1)

RAG ingestion pipeline for the **Thai Tipitaka, Siam Rath / Royal Thai 45-volume edition**.
This is **Phase 1 only**: fetch → parse → chunk (semantic) → embed → store to Qdrant,
writing a structured JSON of chunks + metadata before the vector DB step.

## File structure

```
dhamma-ai/
├── package.json            # deps + scripts
├── .env.example            # copy to .env and fill in
├── docker-compose.yml      # local Qdrant
├── README.md
├── data/
│   ├── samples/            # illustrative offline samples (vol-1, vol-9) for --demo
│   ├── raw/                # fetched HTML (gitignored)
│   └── chunks/             # output: vol-<n>.json (chunks + metadata)
└── src/
    ├── config.js           # env-driven config; auto-selects embedding provider
    ├── ingest.js           # orchestrator + CLI + progress logging
    ├── sources/
    │   ├── volumes.js      # canonical 45-volume → pitaka/nikaya/title map
    │   └── fetch84000.js   # 84000.org fetcher (TIS-620/UTF-8 auto-decode)
    ├── parse/
    │   └── parseSutta.js   # HTML → body text → segment into suttas/sections
    ├── chunk/
    │   └── chunker.js      # semantic chunking (1 sutta/section, ≤1500 Thai chars)
    ├── embed/
    │   └── embedder.js     # Voyage / OpenAI / deterministic mock
    └── store/
        └── qdrant.js       # collection + payload-indexed upsert
```

## Quick start

```bash
cp .env.example .env          # fill in keys (optional for demo)
npm install

# 1) See the full pipeline offline with no keys (uses data/samples):
npm run ingest:demo           # = node src/ingest.js --demo --dry-run --volumes=1

# 2) Start Qdrant locally:
npm run qdrant:up             # docker compose up -d

# 3) Real ingestion of volume 1 (needs network + an embedding key):
npm run ingest:vol1           # = node src/ingest.js --volumes=1

# 4) Full 45 volumes:
npm run ingest
```

### CLI flags
- `--volumes=1` · `--volumes=9-11` · `--volumes=1,9,34` — which volumes (default: all 45)
- `--dry-run` — fetch + parse + chunk + write JSON, but skip embedding & Qdrant
- `--demo` — read `data/samples/vol-<n>.sample.txt` instead of fetching (offline)

## Step 1.2 — Chunking strategy (as implemented)
- **One chunk = one sutta / meaningful sub-section.** Segmentation is by numbered
  ข้อ markers (`[๑]`, `ข้อ ๑`, `๑.`) with the nearest preceding title line
  (ending in สูตร/วรรค/กัณฑ์/ขันธกะ/นิทเทส/ปัณณาสก์/นิบาต) as the sutta name.
- **Max 1,500 Thai characters** (`MAX_CHUNK_CHARS`). Longer suttas split on
  paragraph → phrase-space boundaries with a small overlap. Length is counted in
  Unicode code points, not UTF-16 units, so Thai is measured correctly.
- **Full metadata on every chunk**: `volume, pitaka, nikaya, volume_title,
  sutta_name, sutta_number, page_ref, chunk_index, chunk_of, char_count`.
- Chunks are written to `data/chunks/vol-<n>.json` **before** the vector step.

## Step 1.3 — Embedding & vector store
- Provider auto-selected: `VOYAGE_API_KEY` → Voyage `voyage-multilingual-2` (1024d);
  else `OPENAI_API_KEY` → `text-embedding-3-small` (1536d); else a **deterministic
  mock** (1024d) so the pipeline runs end-to-end without keys.
- Collection created with the matching dimension + Cosine distance, plus payload
  indexes on `volume, pitaka, nikaya, sutta_number` for fast filtered browse/search.
- Each point payload carries `text` + all metadata, so Phase 2 retrieval can build
  exact citations without a second lookup.

## ⚠️ Notes for the founder
- **Volume numbering:** in the Siam Rath 45-vol edition, **เล่ม 1 = วินัยปิฎก
  (มหาวิภังค์ ภาค 1)**. **ทีฆนิกาย มหาวรรค is เล่ม 10**; ทีฆนิกาย starts at เล่ม 9
  (สีลขันธวรรค). The brief said "volume 1 (ทีฆนิกาย มหาวรรค)" — that pairing is
  inconsistent, so `src/sources/volumes.js` uses the canonical mapping. A vol-9
  (ทีฆนิกาย / พรหมชาลสูตร) demo sample is included to show nikaya-level citations.
- **Live fetch parser:** `parse/parseSutta.js` strips page chrome and segments by
  ข้อ markers, with a regex fallback. 84000.org markup varies by volume, so after
  your first real run, inspect `data/raw/vol-<n>.html` and set `CONTENT_SELECTOR`
  / tune `TITLE_RE`/`ITEM_RE` if a volume uses an unusual convention. Verify a few
  chunks against the source before trusting citations — accuracy is the point.
- **page_ref** is left `null` until wired to 84000's A/Z character offsets; add the
  per-page offset map when you confirm the live pagination format.

## Demo output (volume 1, dry-run)
```
parsed 5 sutta/section(s) → 5 chunks
sample id: v1-n1-p0
metadata: { volume:1, pitaka:"วินัยปิฎก", nikaya:null,
            sutta_name:"เวรัญชกัณฑ์", sutta_number:"1", char_count:305 }
```
(With `MAX_CHUNK_CHARS=800`, item ๓ splits into 2 overlapping chunks — proving the
sub-chunking path.)
```
