# PlanetPulse 🌱

**Hackathon Track:** Track 2 — Real-World AI Products (Climate Tech Brief)  
**Hackathon ID:** [PASTE HERE]

---

## What It Does

PlanetPulse lets you log daily carbon-emitting activities, visualize your weekly CO₂ footprint, set a personal target, and receive AI-generated, judgment-free nudges when you're over target. The goal is behavior change through data and encouragement — not shame.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (Postgres) |
| Charts | Recharts |
| AI Nudges | OpenAI GPT-4o-mini (Anthropic Claude fallback) |
| Deploy | Vercel |

---

## Features

- **Dashboard (`/`)** — Weekly CO₂ total, per-category bar chart + accessible table, time-aware progress bar, AI nudge when over target
- **Log Activity (`/log`)** — Form for all 6 activity types with dynamic unit labels, CO₂ preview, absurd-input guard
- **History (`/history`)** — All-time log with combinable type + date filters, URL-reflected for sharing/testing
- **Weekly Target** — Settable, persisted to Supabase, with pace-aware framing

---

## Local Development

### Prerequisites
- Node.js 18+ (`node --version`)
- A Supabase project (free tier works)
- OpenAI API key (or Anthropic API key for Claude)

### 1. Clone and install

```bash
git clone <repo-url>
cd planetpulse
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run **`supabase/schema.sql`** to create tables
3. Then run **`supabase/seed.sql`** to populate demo data
4. Copy your project URL and anon key from **Settings → API**

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=sk-...
```

### 4. Run the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Running Tests

```bash
npm test
```

See [TESTING.md](./TESTING.md) for details.

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add the same environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

## Standard API Note

This hackathon track did not specify a "standard API" contract for script-based grading at the time of submission. All features are accessible via standard browser navigation and REST API endpoints:

- `GET /api/activities` — list activities (query: `from`, `to`, `type`)
- `POST /api/activities` — create activity
- `GET /api/settings` — get weekly target
- `PUT /api/settings` — set weekly target
- `POST /api/nudge` — generate AI nudge message

If a grading script requires a specific API shape, the above endpoints cover all data operations with standard JSON.

---

## Project Structure

```
planetpulse/
├── app/
│   ├── page.tsx            # Dashboard
│   ├── log/page.tsx        # Log activity
│   ├── history/page.tsx    # History + filters
│   └── api/
│       ├── activities/route.ts
│       ├── settings/route.ts
│       └── nudge/route.ts
├── components/
│   ├── ActivityForm.tsx
│   ├── CO2Chart.tsx
│   ├── ProgressBar.tsx
│   ├── NudgePanel.tsx
│   ├── CategoryBadge.tsx
│   ├── Navbar.tsx
│   └── LoadingSpinner.tsx
├── lib/
│   ├── co2.ts              # Emission factors + calculateCO2()
│   ├── supabase.ts         # Supabase client + types
│   ├── week.ts             # ISO week utilities
│   └── __tests__/
│       └── co2.test.ts     # Unit tests
└── supabase/
    ├── schema.sql           # Database schema
    └── seed.sql             # Demo data
```
