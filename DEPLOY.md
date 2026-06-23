# คู่มือ Deploy — Dhamma AI (Phase 6)

คู่มือพา deploy ระบบขึ้นใช้งานจริง แบบใช้ free tier ทั้งหมด (มีค่าใช้จ่ายเฉพาะ
ค่า API ของ Voyage + Claude ตามการใช้งาน)

## ภาพรวมสถาปัตยกรรม

ระบบมี 3 ส่วน host คนละที่ เพราะมีธรรมชาติต่างกัน:

```
┌─────────────┐      ┌──────────────────┐      ┌────────────────┐
│  Frontend   │ ───► │   API (Express)  │ ───► │  Qdrant Cloud  │
│  Next.js    │ HTTP │  Render free     │      │  (vector DB)   │
│  Vercel     │      │                  │ ───► │  Claude + Voyage API
└─────────────┘      └──────────────────┘
```

- **Frontend** → Vercel (เหมาะกับ Next.js มาก, ฟรี)
- **API** → Render free web service (รัน Node ตลอด, ฟรี 750 ชม./เดือน)
- **Qdrant** → Qdrant Cloud free tier (0.5 vCPU, 1GB RAM, 4GB disk)

> ทำไมไม่เอา API ขึ้น Vercel? เพราะ Vercel เป็น serverless (ฟังก์ชันอายุสั้น)
> รัน Qdrant client ที่ต้องต่อค้างและงาน ingest ที่ใช้เวลานานไม่เหมาะ

---

## สิ่งที่ต้องเตรียม (Prerequisites)

- บัญชี GitHub (push โค้ด)
- บัญชี Vercel (เชื่อมกับ GitHub ได้)
- บัญชี Render — https://render.com
- บัญชี Qdrant Cloud — https://cloud.qdrant.io
- API keys ที่มีอยู่แล้ว: `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`

---

## ขั้นที่ 1 — Qdrant Cloud (ฐานข้อมูล vector)

**1.1** สมัคร/ล็อกอิน https://cloud.qdrant.io → **Create Cluster** → เลือก **Free**
(0.5 vCPU / 1GB RAM / 4GB disk) เลือก region ใกล้ไทยที่สุด (เช่น Singapore/AP)

**1.2** เมื่อ cluster พร้อม จะได้ **Cluster URL** (เช่น `https://xxxx.aws.cloud.qdrant.io:6333`)
และสร้าง **API Key** (เมนู Data Access / API Keys) — เก็บไว้

**1.3** นำข้อมูล 45 เล่มขึ้น cloud — วิธีที่ง่ายสุดคือ **ingest ใหม่ชี้ไป cloud**
แก้ `.env` ในเครื่อง (ชั่วคราว):

```
QDRANT_URL=https://xxxx.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=<คีย์จาก Qdrant Cloud>
```

แล้วรัน (รอบเดียว, ~1–2 ชม.):

```bash
npm run ingest
```

ตรวจยอด:

```bash
curl -s "$QDRANT_URL/collections/tipitaka_siamrath" -H "api-key: $QDRANT_API_KEY" | grep points_count
```

> **ทางเลือกขั้นสูง:** ถ้าไม่อยาก ingest ใหม่ ใช้ snapshot ของ Qdrant local
> (`POST /collections/tipitaka_siamrath/snapshots`) แล้ว upload เข้า cloud ได้
> แต่วิธี ingest ใหม่ง่ายและชัวร์กว่าสำหรับครั้งแรก

> ⚠️ **ข้อควรรู้ free tier:** cluster จะถูก *suspend* ถ้าไม่ใช้งาน 1 สัปดาห์
> และถูกลบถ้าทิ้งไว้ 4 สัปดาห์ — มีคนใช้สม่ำเสมอก็ไม่โดน

---

## ขั้นที่ 2 — Push โค้ดขึ้น GitHub

```bash
cd <โฟลเดอร์ dhamma-ai>
git init
git add .
git commit -m "Dhamma AI — initial"
# สร้าง repo ว่างบน github.com ก่อน แล้ว:
git remote add origin https://github.com/<you>/dhamma-ai.git
git push -u origin main
```

> เช็คว่า `.gitignore` กัน `.env`, `node_modules/`, `qdrant_storage/`, `data/raw`,
> `data/chunks` ไว้แล้ว (มีให้ในโปรเจกต์) — **อย่า commit ไฟล์ `.env` ที่มี key**

---

## ขั้นที่ 3 — Deploy API (Express) บน Render

**3.1** https://render.com → **New** → **Web Service** → เชื่อม GitHub repo

**3.2** ตั้งค่า:

| ช่อง | ค่า |
|------|-----|
| Root Directory | *(เว้นว่าง — โค้ด API อยู่ที่ราก)* |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `node src/server.js` |
| Instance Type | Free |

**3.3** เพิ่ม Environment Variables (เมนู Environment):

```
ANTHROPIC_API_KEY = sk-ant-...
VOYAGE_API_KEY     = pa-...
VOYAGE_MODEL       = voyage-multilingual-2
QDRANT_URL         = https://xxxx.aws.cloud.qdrant.io:6333
QDRANT_API_KEY     = <คีย์ Qdrant Cloud>
QDRANT_COLLECTION  = tipitaka_siamrath
RAG_MIN_SCORE      = 0.4
API_CORS_ORIGIN    = https://<ชื่อแอป>.vercel.app
```

> `API_CORS_ORIGIN` ใส่ทีหลังได้ หลังรู้โดเมน Vercel (ขั้นที่ 4) แล้วกลับมาแก้
> โค้ดอ่าน `PORT` ที่ Render ฉีดให้อัตโนมัติ ไม่ต้องตั้ง `API_PORT`

**3.4** กด **Create Web Service** → รอ build → จะได้ URL เช่น
`https://dhamma-ai-api.onrender.com` ทดสอบ:

```bash
curl https://dhamma-ai-api.onrender.com/api/health
```

> ⚠️ **Free tier sleep:** บริการจะหลับหลังไม่มีทราฟฟิก 15 นาที คำขอแรกหลังหลับ
> จะช้า ~10–30 วิ (cold start) จากนั้นเร็วปกติ — รับได้สำหรับ MVP
> ถ้าต้องการไม่หลับ อัปเกรดเป็น Starter (~\$7/เดือน) ภายหลัง

---

## ขั้นที่ 4 — Deploy Frontend บน Vercel

**4.1** https://vercel.com → **Add New** → **Project** → import repo เดียวกัน

**4.2** ตั้งค่า:

| ช่อง | ค่า |
|------|-----|
| Root Directory | `web` |
| Framework Preset | Next.js (auto) |
| Build Command | `next build` (auto) |

**4.3** เพิ่ม Environment Variable:

```
NEXT_PUBLIC_API_URL = https://dhamma-ai-api.onrender.com
```

**4.4** กด **Deploy** → ได้โดเมน เช่น `https://dhamma-ai.vercel.app`

**4.5** กลับไปที่ Render → แก้ `API_CORS_ORIGIN` ให้เป็นโดเมน Vercel จริง
(เช่น `https://dhamma-ai.vercel.app`) → Render จะ redeploy ให้ →
เปิดเว็บแล้วลองถามได้เลย

---

## ขั้นที่ 5 — Hardening ก่อนใช้งานจริง (แนะนำ)

1. **อัปเกรด Next.js** แก้ช่องโหว่ — ใน `web/package.json` เปลี่ยน
   `"next": "14.2.15"` เป็น `"next": "^14.2.33"` แล้ว `cd web && npm install`
   (อยู่ใน 14.x ไม่ breaking)
2. **CORS เฉพาะโดเมน** — `API_CORS_ORIGIN` อย่าใช้ `*` ใน production ตั้งเป็น
   โดเมน Vercel เท่านั้น
3. **เก็บ key ใน env เท่านั้น** — อย่า hardcode / อย่า push `.env`
4. **Feedback → Google Sheet** (Phase 5) — ตอนนี้ `/api/feedback` เขียนลงไฟล์
   `data/feedback.jsonl` บน Render ซึ่งไฟล์หายเมื่อ redeploy ถ้าจะเก็บถาวร
   ให้เปลี่ยนเป็นเขียนเข้า Google Sheet (เพิ่ม Apps Script webhook แล้ว POST
   ไปหา) หรือใช้ตาราง Qdrant/DB แยก

---

## สรุปค่าใช้จ่าย

| ส่วน | บริการ | ค่าใช้จ่าย |
|------|--------|-----------|
| Frontend | Vercel | ฟรี |
| API | Render free | ฟรี (มี cold start) |
| Vector DB | Qdrant Cloud free | ฟรี (1GB RAM) |
| Embedding | Voyage API | ตามใช้งาน (ค้นหาถูกมาก) |
| LLM | Claude API | ตามใช้งาน (ต่อคำถาม) |

ต้นทุนคงที่ = 0 จ่ายเฉพาะ Voyage + Claude ตามจำนวนคำถามจริง

---

## Troubleshooting

- **เว็บถามแล้วขึ้น error / CORS** → เช็ค `API_CORS_ORIGIN` บน Render ตรงกับโดเมน
  Vercel ไหม และ `NEXT_PUBLIC_API_URL` บน Vercel ชี้ API ถูกไหม
- **คำขอแรกช้ามาก** → Render free หลับอยู่ (cold start) ปกติ
- **ตอบ not_found ตลอด** → ข้อมูลไม่ได้ขึ้น Qdrant Cloud (เช็ค points_count) หรือ
  `RAG_MIN_SCORE` สูงไป
- **build Vercel ล้มที่ฟอนต์** → ไม่เกิด เพราะเราโหลด Sarabun ผ่าน `<link>` แล้ว
```
