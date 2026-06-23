# Dhamma AI — Frontend (Phase 4, Next.js)

Minimal chat UI over the Phase 3 API. Single chat page + a browse page for the
45 volumes. Thai font (Sarabun), palette: gold #B7950B / brown #2C1810 /
cream #FDF6E3 / sage #7D9B76. Free tier, no login.

## Run locally

```bash
cd web
cp .env.local.example .env.local      # set NEXT_PUBLIC_API_URL (default localhost:3001)
npm install
npm run dev                           # http://localhost:3000
```

The Express API (Phase 3) must be running and reachable at `NEXT_PUBLIC_API_URL`.

## Pages
- `/`        chat — ask a question, get answer + 📚 citations (expandable) +
             🔍 raw scripture sources (expandable) + confidence badge +
             "แจ้งคำตอบไม่ถูกต้อง" button (POST /api/feedback).
- `/browse`  browse all 45 volumes grouped by piṭaka → chapter list per volume.

## Deploy to Vercel

The **frontend** deploys to Vercel. The **API + Qdrant** must be hosted
separately (Qdrant Cloud + the Express app on Render/Railway/Fly/a VM), because
Qdrant and the long-running ingest don't fit Vercel's serverless model.

1. Push the repo to GitHub.
2. In Vercel → New Project → import the repo. Set **Root Directory = `web`**.
3. Framework preset: **Next.js** (auto-detected). Build: `next build`.
4. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your deployed API URL (e.g. `https://api.dhamma.example`)
5. Deploy.

### Environment variables summary
| Where        | Variable              | Example                          |
|--------------|-----------------------|----------------------------------|
| web (Vercel) | `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com`     |
| API host     | `ANTHROPIC_API_KEY`   | `sk-ant-…`                       |
| API host     | `VOYAGE_API_KEY`      | `pa-…`                           |
| API host     | `QDRANT_URL`          | `https://xxx.qdrant.io:6333`     |
| API host     | `QDRANT_API_KEY`      | `…`                              |
| API host     | `API_CORS_ORIGIN`     | `https://your-vercel-app.vercel.app` |

> Set `API_CORS_ORIGIN` on the API to your Vercel domain so the browser can call it.
