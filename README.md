# 🎯 AI Lead Generation Agent

An autonomous system that scrapes social platforms (X/Twitter), leverages GPT-4 to score leads based on actual buying intent, and generates personalized, high-converting outreach messages.

## 🏗️ Architecture

The system is split into multiple specialized microservices:

1. **Frontend Dashboard (Next.js)**
   - Query builder to add target search terms.
   - Real-time stats (Total Leads, Hot Leads, Avg Intent).
   - Live Feed of scraped leads, sorted and grouped by search context.
   - UI to generate tailored AI replies.

2. **Backend API (Node.js/Express + Prisma)**
   - Manages CRUD operations for Leads, Queries, and AI Replies.
   - Stores data securely in PostgreSQL.
   - Triggers the scraper and manages rate limiting.

3. **Data Pipeline & Workers**
   - **X Scraper (`x_worker.py`):** Uses Playwright to navigate X, execute searches, and scrape posts. It implements a "Dumb Filter" to auto-reject obvious false positives (e.g., #buildinpublic, solo builders). Raw leads are pushed to a Redis queue.
   - **Intent Scorer (`intentWorker.ts`):** Pulls raw leads from Redis and sends them to GPT-4o-mini. The AI uses strict rubrics to assign an `intentScore` (buying intent) and a `founderScore` (decision-maker likelihood).

## ✨ Key Features

- **The "Builder Trap" Filter:** Python-layer filter drops tweets from solo creators promoting their own SaaS or asking for feedback, saving AI credits.
- **Time-Decay Scoring:** The AI dynamically penalizes the intent score of older posts (because a post from 7 days ago means they probably already found someone).
- **"Transfer of Value" AI Rule:** The AI explicitly looks for buying signals (someone looking to pay money for work) rather than just syntactic matches.
- **Architect Persona Replies:** Generates high-converting, non-salesy outreach messages using a "Senior Software Architect" persona. Choose between *Helpful*, *Authoritative*, or *Witty* tones.
- **Deduplication:** Redis sets ensure the same tweet is never scraped or sent to the AI twice.

## 🚀 Getting Started

### Prerequisites
- Node.js & Bun
- Python 3.x
- PostgreSQL
- Redis Server
- OpenAI API Key

### Installation

1. **Clone the repository and install dependencies:**
    ```bash
    # Install backend dependencies
    cd lead-hunter-api
    bun install
    pip install playwright redis python-dotenv requests
    playwright install chromium

    # Install frontend dependencies
    cd ../frontend
    bun install
    ```

2. **Set up Environment Variables:**
    Create a `.env` file in `lead-hunter-api`:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/lead_hunter"
    REDIS_URL="redis://localhost:6379"
    OPENAI_API_KEY="sk-your-openai-key"
    CORS_ORIGIN="http://localhost:3000"
    ```

3. **Setup Database:**
    ```bash
    cd lead-hunter-api
    npx prisma db push
    ```

### Running the App

You need to run several services concurrently. Open multiple terminal tabs:

**Terminal 1: Redis**
```bash
redis-server
```

**Terminal 2: Background AI Worker**
```bash
cd lead-hunter-api
bun run dev:worker
```

**Terminal 3: Backend API**
```bash
cd lead-hunter-api
bun dev
```

**Terminal 4: Frontend Dashboard**
```bash
cd frontend
bun dev
```

Visit `http://localhost:3000` to view the dashboard!

## 🧪 Usage

1. Go to the dashboard.
2. Enter target keywords (e.g., `need a developer`, `building an mvp`).
3. Click **"Force Scrape"**.
4. The Python scraper will open a headless browser, scroll X, and push matches to Redis.
5. Watch the dashboard as the AI processes the queue in real-time, grades the leads, and assigns scores.
6. Click **"Generate Reply"** on any high-intent lead to get an AI-crafted opening message.
