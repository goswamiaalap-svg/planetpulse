# PlanetPulse — Production & Vercel Deployment Guide

## 1. Overview
PlanetPulse uses **OpenRouter** as the unified LLM inference provider for the **AI Carbon Coach** and RAG intelligence system, powered by `qwen/qwen3-32b` (with high-capability fallback to `qwen/qwen-2.5-72b-instruct`).

All AI inference, vector retrieval, and database auditing run strictly **server-side** in Next.js Serverless Edge/Node route handlers. No API keys are ever transmitted or exposed to the client-side browser.

---

## 2. Environment Variables Configuration

### Required Environment Variables

| Variable Name | Description | Environment | Sensitive |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Production, Preview, Local | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key | Production, Preview, Local | No (Client-safe) |
| `OPENROUTER_API_KEY` | OpenRouter secret API key | Production, Preview, Local | **YES (Server-only)** |
| `OPENROUTER_MODEL` | OpenRouter model slug (default: `qwen/qwen3-32b`) | Production, Preview, Local | No |

> ⚠️ **CRITICAL SECURITY NOTE**: Never commit `.env` or `.env.local` to Git. Ensure `.gitignore` ignores all `.env*` files.

---

## 3. Local Development Setup

1. Clone repository and install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
3. Add your OpenRouter API key to `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_MODEL=qwen/qwen3-32b
   ```
4. Run the local dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to interact with the dashboard and AI Carbon Coach.

---

## 4. Vercel Production Deployment

### Step A: Configure Environment Variables in Vercel
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Select the `planetpulse` project.
3. Navigate to **Settings** → **Environment Variables**.
4. Add the following:
   - **Name**: `OPENROUTER_API_KEY`
   - **Value**: `<your_openrouter_api_key>`
   - **Target**: Production, Preview, Development
5. (Optional) Add `OPENROUTER_MODEL`:
   - **Name**: `OPENROUTER_MODEL`
   - **Value**: `qwen/qwen3-32b`

### Step B: Redeploy to Activate Changes
After adding or modifying environment variables in Vercel:
1. Go to the **Deployments** tab in Vercel.
2. Click the three dots (`...`) on the latest deployment and select **Redeploy** (or push a new commit to Git).
3. The newly spawned build will read `OPENROUTER_API_KEY` from the secure environment.

---

## 5. RAG Pipeline Architecture

```
User Query (e.g. "Why did my footprint increase this week?")
  ↓
/api/ai/coach (Serverless API)
  ↓
UserContextBuilder (DB Analytics: current week, previous week, delta, largest sector)
  ↓
Query Intent Classifier & Rewriter
  ↓
Hybrid Retrieval (Vector Search + Keyword RRF over authoritative UN ActNow, EPA, GHG Protocol docs)
  ↓
OpenRouter API (qwen/qwen3-32b)
  ↓
Response Validation & Source Traceability (Verified JSON with real external citation URLs)
  ↓
Frontend AICarbonCoach Widget
```

---

## 6. Testing & Verification

Run the automated test suite locally:
```bash
npm test
```
- Covers all 6 deterministic CO₂ emission factors (`co2.test.ts`).
- Covers document loading, chunking, unit embeddings, hybrid search, intent classification, user context builder, what-if simulator, and coach grounding (`rag.test.ts`).
- Total: 35 passing unit tests.
