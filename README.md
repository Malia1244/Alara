# Alara

Alara is an AI study companion that helps students remember what they learn
each day. See `prd.txt` for the full product vision.

This repo currently implements **today's slice** (see `justinwantstosee.txt`):

- No login yet — just one main page.
- Paste in what you learned today (subject + notes).
- Entries are saved to Supabase and shown in a list.

## How the pieces fit together

```
Browser  --->  Next.js (frontend)  --->  FastAPI (backend)  --->  Supabase (database)
 :3000              :3000                    :8000                  cloud
```

- **Frontend (Next.js + React + Tailwind)** — the page you see and type into.
  It never talks to Supabase directly; it only calls the backend.
- **Backend (FastAPI, Python)** — the only thing that holds the secret
  Supabase key. It exposes two endpoints: save an entry, list entries.
- **Database (Supabase / Postgres)** — stores every learning entry
  permanently in the `daily_learning_entries` table.

Keeping the secret key only in the backend (never in the browser) is why
there are two servers instead of one.

## Running it locally

You need **two terminals** open at the same time — one for each server.

### 1. Backend (FastAPI)

```powershell
cd backend
py -m venv .venv          # only needed once
.\.venv\Scripts\pip.exe install -r requirements.txt   # only needed once / after changes
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

It should print something like `Uvicorn running on http://127.0.0.1:8000`.

Before running it the first time, make sure `backend/.env` has your real
Supabase **Project URL** and **secret key** (see below).

### 2. Frontend (Next.js)

```powershell
cd frontend
npm install     # only needed once / after changes
npm run dev
```

Open **http://localhost:3000** in your browser.

### 3. Try it

1. Type a subject (e.g. "Biology") and paste some notes.
2. Click **Save today's learning**.
3. The entry appears in the list below.
4. Refresh the page — it's still there (it's saved in Supabase, not just in
   the browser).

## Environment variables

### `backend/.env`

```
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_secret_key
```

Get both from the Supabase dashboard: **Project Settings → API**.

- `SUPABASE_URL` must start with `https://` and end with `.supabase.co`.
  It is **not** the same as an API key.
- The secret/service_role key should never be committed to git or shared
  publicly — it can read and write your entire database. `.env` is already
  in `.gitignore`.

### `frontend/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

This just tells the frontend where the backend is running locally.

## Database schema

Run this once in the Supabase SQL Editor (Project → SQL Editor → New query):

```sql
create table public.daily_learning_entries (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.daily_learning_entries enable row level security;

create policy "Allow public read"
  on public.daily_learning_entries for select using (true);

create policy "Allow public insert"
  on public.daily_learning_entries for insert with check (true);
```

The public read/insert policies are temporary — they exist because there's
no login yet. Once accounts are added, these will be replaced with policies
that only let each user see and edit their own entries.

## What's intentionally not built yet

Per today's scope, these come later:

- Login / accounts
- Uploading images of notes (typed/pasted notes only for now)
- Voice input
- Quiz generation, AI memory, Ara, the shop — see `prd.txt`

## Project structure

```
Alara/
├── backend/
│   ├── main.py            # FastAPI app: save + list learning entries
│   ├── requirements.txt
│   └── .env                # Supabase URL + secret key (not committed)
├── frontend/
│   └── src/
│       ├── app/page.tsx    # main page: form + entry list
│       ├── app/layout.tsx
│       └── lib/api.ts      # talks to the backend
├── prd.txt                 # full product spec
└── justinwantstosee.txt    # today's requirements
```
