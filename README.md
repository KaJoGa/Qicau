# Qicau

> Say it, Save it.

A voice-first Progressive Web App for personal expense tracking, designed for the Indonesian market. Tap, speak your expense (in Indonesian, English, or mixed), and Qicau transcribes, categorizes, and saves it — all in one tap.

## Features

### Voice & Text Input
- **Voice input** — Tap to record ("Beli kopi goceng di Starbucks pakai gopay"). Auto-stops on 2s silence; hard cap at 60s per recording.
- **Bilingual recognition** — Speak Indonesian, English, or mixed. Categories always output in Indonesian (`Makan`, `Jajan`, `Transport`, `Belanja`, `Tagihan`, `Lainnya`).
- **Manual text input** — Fallback for noisy environments. Same Gemini parser, no STT involved.
- **Audio feedback** — Beep on start/stop + haptic vibration.
- **Low-confidence prompt** — When parser confidence is low, shows a styled modal (not native `alert`) with options to retry or enter manually.

### AI Parsing (Gemini)
- Few-shot prompt with explicit amount unit rules:
  - Standard: `ribu` / `rb` / `k` → ×1000, `juta` / `jt` → ×1000000
  - **Indonesian Hokkien slang**: `cepe`=100, `gocap`=50, `goceng`=5000, `ceban`=10000, `goban`=50000, `cepego`=100000, `cetiaw`=1000000, etc.
- **Platform trigger words**: `Restoran`, `Cafe`, `Warung`, `Depot`, `Minimarket`, `Supermarket`, `Mall`, etc. signal that following words are a place name. Parser tries phonetic match to known brands first (e.g., `salaria`→`Solaria`, `kaku`→`Gyu-Kaku`), falls back to verbatim transcription with trigger prefix for unknown local places.
- **Known brand list** built into the prompt covers Indonesian fast food, restaurant chains, cafes, minimarkets, supermarkets, transport, and marketplaces — so misheard names get corrected.
- Recognizes Indonesian payment methods (`Cash`, `QRIS`, `Transfer`, `GoPay`, `OVO`, `DANA`, `ShopeePay`, `Kartu`, `Paylater`).
- Lenient confidence calibration — partial info still fills the response with best-effort.
- Model fallback chain: `gemini-3.5-flash-lite` → `gemini-3.8-flash` → `gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.0-flash` → `gemini-2.5-flash` (auto-retries on 503 / quota errors).

### Views
- **Home (Catat)** — Today's total, last 3 transactions, save toast with Edit / Undo (5s window).
- **History (Riwayat)** — Server-side pagination (30 per page) using Firestore cursor `startAfter`; client-side category filter; server-side date filter (7d / 30d / this month / all); transaction detail modal.
- **Monthly (Bulanan)** — This month's total, per-category breakdown with pie chart and percentage bars.

### Settings & UX
- Dark / Light / System theme with `localStorage` persistence.
- Glass-effect header & bottom nav with `backdrop-blur`.
- Centered max-width container (`max-w-3xl`) so desktop view doesn't stretch edge-to-edge.
- Skeleton loaders on first load.
- Global toast notifications (success / error) lifted to App.tsx — visible across any tab.
- **Sync state lifted to App** — Sheets sync button stays in loading state even when user switches tabs, preventing spam clicks.
- HTML `Cache-Control: no-store` so users always get latest asset hashes after redeploy (no more stale-cache black screens on mobile).
- PWA installable (manifest + service worker stub + icons at `images/icon-192.png` & `images/icon-512.png`).

### Low-Confidence Logging (Self-Improvement Loop)
- When Gemini returns `confidence: "low"`, the transaction is **not saved** — a styled modal asks the user to retry or input manually.
- The failed parse is logged to Firestore collection `low_confidence_logs` with:
  - `raw_transcript` — verbatim of what Gemini heard
  - `gemini_output` — the structured but rejected parse
  - `source` — voice or text
  - `input_text` — present only for text input
- Workflow: open Firebase Console → review logs → identify where parsing went wrong (missed brand, unrecognized slang, ambiguous phrasing) → update the prompt's brand list, slang dictionary, or examples → redeploy. The app gets smarter over time based on real misses.

### Export
- **CSV** — Local download, Indonesian headers, currency-formatted.
- **Google Sheets sync** — Per-year spreadsheet (`Qicau_Export_YYYY`) with:
  - Monthly tabs (e.g., `Mei 2026`) — main table at A1, frozen header row.
  - Side tables (columns I-J): `Statistik {Month} {Year}` + `Kategori {Month} {Year}` — table titles are merged across both columns and center-aligned.
  - **Summary tab** — Cross-month aggregates (`Total Hari`, `Total Transaksi`, averages, total spend, category breakdown) with auto-generated pie chart. No frozen rows on Summary tab (freeze only on monthly tabs).
  - Data validation, conditional formatting, banded rows, currency formatting (`Rp` pattern).
  - Idempotent re-sync — `is_exported` flag in Firestore prevents duplicate writes.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **Backend**: Express 4 (proxies Gemini API)
- **AI**: Google Gemini (multimodal — audio + text)
- **Data**: Firebase Auth (Google) + Cloud Firestore
- **Export**: Google Sheets API v4, Google Drive API v3
- **Charts**: Recharts (pie chart in monthly view)
- **Icons**: Lucide React

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and set your Gemini API key:

```env
GEMINI_API_KEY="your-key-from-aistudio.google.com/apikey"
```

> **Firebase config note**: Firebase web configuration is loaded directly from `firebase-applet-config.json` (committed to the repo). These keys are public by design for client-side Firebase SDKs — security is enforced by `firestore.rules`, not by hiding the API key.

### 3. Run the dev server

```bash
npm run dev
```

Opens at http://localhost:3000 by default (full-stack: Express + Vite middleware). If port 3000 is already in use on your machine, the server automatically picks a free port instead and prints the actual URL to the console. To pin a specific port, set `PORT` in your environment (e.g. `PORT=5173 npm run dev`) — an explicit `PORT` is used as-is and the server fails loudly if that one is taken.

## Deployment

This project deploys as a Cloudflare Worker with static assets and Worker API
routes. Configure the Worker variable `GEMINI_API_KEY` as a secret, then run:

```bash
npm run deploy
```

The Worker serves the Vite build from `dist/` and handles:

- `POST /api/parse-audio`
- `POST /api/parse-text`

Do not deploy this project as a static-only site. The `functions/` directory is
for Cloudflare Pages and is not used when deploying a `workers.dev` Worker.

## Project Structure

```
src/
├── App.tsx                  # Root: auth, theme, settings, tab nav, sync state, global toast
├── main.tsx                 # Vite entry
├── index.css                # Tailwind + custom keyframes
├── types.ts                 # Transaction + ParsedTransaction types (+ raw_transcript)
├── components/
│   ├── HomeView.tsx         # Record button, today total, recent, edit modal, low-confidence modal, log writer
│   ├── HistoryView.tsx      # Paginated history, filters, detail modal, sync trigger
│   └── MonthlyView.tsx      # Monthly summary, pie chart, category bars
└── lib/
    ├── audio.ts             # MediaRecorder + silence detection + playBeep
    ├── firebase.ts          # Firebase init (auth, firestore, googleProvider)
    ├── i18n.ts              # Indonesian string dictionary
    └── sheetsSync.ts        # Google Sheets export with merged titles + cross-sheet formulas

server.ts                    # Express + Vite dev middleware + Gemini proxy
firestore.rules              # Firestore security rules (per-user isolation)
firebase-applet-config.json  # Firebase web config (public)
public/
├── manifest.json            # PWA manifest
├── sw.js                    # Service worker stub
└── images/
    ├── Qicau_Logo.png       # App logo (1024x1024)
    ├── icon-192.png         # PWA icon (192x192)
    └── icon-512.png         # PWA icon (512x512)
```

## Firestore Schema

```
users/{uid}
  email, displayName, photoURL, last_login

transactions/{auto_id}
  user_id          string
  kategori         "Makan" | "Jajan" | "Transport" | "Belanja" | "Tagihan" | "Lainnya"
  platform         string    (e.g., "Warmindo", "Starbucks", "Gojek")
  harga            number    (IDR, integer)
  detail           string    (item description)
  payment_method   string    ("Cash" | "QRIS" | "Transfer" | "GoPay" | ...)
  confidence       "high" | "medium" | "low"
  raw_transcript?  string    (Gemini-heard verbatim, optional)
  created_at       number    (epoch ms)
  is_exported?     boolean   (set to true after Sheets sync)

low_confidence_logs/{auto_id}
  user_id          string
  attempted_at     number    (epoch ms)
  source           "voice" | "text"
  input_text?      string    (present only when source == "text")
  raw_transcript   string    (Gemini-heard verbatim)
  gemini_output    object    (full rejected parse result)
```

Security: only the authenticated owner (`user_id == request.auth.uid`) can read/write their own transactions and low-confidence logs.
