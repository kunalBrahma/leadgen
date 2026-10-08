# Lead Hunter — AI-Powered Foreign Client Acquisition for SiteMakerLab

Lead Hunter is an autonomous lead generation system built for **SiteMakerLab** to find and engage foreign web design clients (US, UK, Canada, Australia) across Reddit, LinkedIn, and X (Twitter).

It scrapes three platforms, grades every lead with GPT-4o using a custom scoring matrix tuned for web design buyers, and generates platform-native outreach — public Reddit comments, tweet replies, or LinkedIn DMs — all from a single dashboard.

---

## How It Works

```
Scraper (Reddit / X / LinkedIn)
    ↓ pushes raw lead JSON
Redis Queue (port 6380)
    ↓ brpop
Intent Worker (GPT-4o grading)
    ↓ upsert with scores + icebreaker
PostgreSQL (Prisma)
    ↓ REST API
Next.js Dashboard
    ↓
Copy comment / reply / DM → Send
```

---

## Scoring System

Every lead is graded on three axes via GPT-4o Structured Outputs (Zod schema):

| Axis | Max | What it measures |
|---|---|---|
| Buying Power | 4 | Are they a business owner who controls budget? |
| Pain Awareness | 3 | Are they explicitly complaining about their website? |
| Actionability | 3 | Are they ready to act now? |
| **Intent Score** | **10** | Overall buyer qualification |

- `intentScore >= 5` → **Verified Buyer** (shown in feed)
- `intentScore >= 7` → **Hot Lead** (highlighted)
- `intentScore >= 9` → **Extreme Intent** (filter available)

### Automatic disqualification (score = 1)
- Web developers, designers, agencies selling their own services
- Students, job seekers, DIY builders
- "Build in public" / indie hackers with no business
- Competitors

---

## Platform Strategy

### Reddit (Best Quality)
- Targets `r/smallbusiness`, `r/entrepreneur`, `r/startups`, `r/webdesign`, `r/Wordpress` by default
- Subreddits are configurable from the Settings page — no code changes needed
- Uses Reddit's JSON API (no Playwright, no login, no rate limit issues)
- Generates **public comment replies** — not DMs
- Reply styles: Share Story / Helpful Advice / Ask a Question
- Dedup: Redis cache + PostgreSQL fallback (survives Redis restarts)

### LinkedIn (Professional)
- Scrapes content search filtered to US, UK, Canada, Australia, NZ, Ireland via geoUrn
- Uses saved cookies from `linkedin_auth.py`
- Generates professional **LinkedIn DMs**
- Reply styles: Helpful / Share Story / Authoritative

### X / Twitter (Supplementary)
- Filters with `lang:en` to target English-speaking markets
- Generates short punchy **tweet replies** (≤240 chars)
- Reply styles: Call It Out / Witty / Helpful
- Note: X DMs require mutual follow or open DM settings

---

## Tech Stack

**Backend**
- Node.js + Express + TypeScript
- Prisma ORM → PostgreSQL
- Redis (queue)
- OpenAI SDK (GPT-4o-mini — grading + replies)
- Zod (Structured Outputs)
- Socket.io (WebSockets)

**Scrapers**
- Python 3.10+
- `reddit_worker.py` — requests + Reddit JSON API
- `x_worker.py` — Playwright (headless browser)
- `linkedin_worker.py` — Playwright + cookie auth

**Frontend**
- Next.js (App Router)
- Tailwind CSS + Shadcn UI
- Tabler Icons

---

## Setup

### Prerequisites
- Node.js v18+
- Python 3.10+
- PostgreSQL on port 5433
- Redis on port 6380
- OpenAI API key

### 1. Install dependencies

```bash
# Backend
cd lead-hunter-api
npm install

# Python scraper dependencies
python3 -m venv venv
source venv/bin/activate
pip install playwright redis requests
playwright install chromium

# Frontend
cd ../frontend
npm install
```

### 2. Environment variables

**`lead-hunter-api/.env`**
```env
DATABASE_URL="postgresql://admin:password@localhost:5433/lead_hunter?schema=public"
REDIS_URL="redis://localhost:6380"
OPENAI_API_KEY="sk-your-key"
OPENAI_MODEL="gpt-4o-mini"
CORS_ORIGIN="http://localhost:3001"
PORT=3000
```

**`frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

### 3. Database

```bash
cd lead-hunter-api
npx prisma generate
npx prisma db push
```

### 4. LinkedIn authentication (first time only)

```bash
cd lead-hunter-api
source venv/bin/activate
python3 linkedin_auth.py
# Log in manually in the browser that opens — cookies saved automatically
```

---

## Running the System

Open 4 terminal tabs:

```bash
# Tab 1 — Redis
redis-server --port 6380

# Tab 2 — Backend API
cd lead-hunter-api && npm run dev

# Tab 3 — Intent Worker (GPT grader)
cd lead-hunter-api && npx ts-node src/workers/intentWorker.ts

# Tab 4 — Frontend
cd frontend && npm run dev -- -p 3001
```

Dashboard: `http://localhost:3001/dashboard`

---

## Usage

### Scraping

1. Go to **Settings** → add search keywords and configure target subreddits
2. On the **Dashboard**, type a query, select platform (Reddit / LinkedIn / X), click **Force Scrape**
3. Watch the Intent Worker terminal — leads are graded in real time
4. Qualified buyers appear in the Live Feed grouped by platform then by query

### Outreach

Each lead card shows:
- **Intent Score** (1-10) with buying power / pain / actionability breakdown
- **AI Analysis** — one-line qualification reason
- **Suggested Comment / DM** — pre-written, platform-native opener
- **Generate Comment / Tweet Reply / Reply** — choose a style and generate

**Per platform:**
- Reddit → copy the suggested comment, post it publicly in the thread
- X → use "Tweet Reply" to draft a public reply or "Twitter DM" for direct message
- LinkedIn → copy the DM and send via LinkedIn messaging

### Lead Status Tracking

Each card has a status tracker:
- **Contacted** — you sent the message
- **Replied** — they responded
- **Closed** — you won the client

---

## Settings Page

| Section | What it controls |
|---|---|
| Search Keywords | Queries used by X and LinkedIn scrapers |
| Target Subreddits | Subreddits the Reddit scraper searches (add/remove without touching code) |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/leads` | Fetch leads with filters/sort/pagination |
| GET | `/api/leads/stats` | Total, hot leads, avg score, buyer count |
| PATCH | `/api/leads/:id/status` | Update lead status (detected/contacted/replied/closed) |
| DELETE | `/api/leads` | Delete all leads |
| POST | `/api/scrape` | Trigger scraper (body: `{ queries, platform }`) |
| GET | `/api/queries` | Get active search keywords |
| POST | `/api/queries` | Save search keywords |
| GET | `/api/queries/subreddits` | Get active subreddits |
| POST | `/api/queries/subreddits` | Save subreddits |
| POST | `/api/leads/:leadId/generate-reply` | Generate platform-aware reply |
