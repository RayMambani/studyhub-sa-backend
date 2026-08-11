# StudyHub SA — REST API

Node.js + Express REST API backing the StudyHub SA Android app. Stores data
in SQLite (via `better-sqlite3`) — a single file database that needs no
separate server, which keeps this easy to deploy for a student project. Swap
`db/db.js` for a Postgres/MySQL client later if you need something that
scales past one file; every route only calls the functions that file exports.

## What it does

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/register` | Create an account. Password is hashed with **bcrypt** (12 salt rounds) before it ever touches disk. |
| `POST /api/auth/login` | Verify email/password, return a JWT. |
| `POST /api/auth/google` | Single sign-on — verifies a Google ID token from the Android app and logs the user in / registers them. |
| `PATCH /api/users/settings` | Update language (`en`/`zu`/`ve`) and FCM push token — backs the Settings screen. |
| `GET/POST /api/resources` | Resource Library — list, search, and upload files. |
| `GET/POST /api/groups`, `/api/groups/:id/messages` | Study groups and group chat. |
| `GET /api/notes`, `POST /api/notes/sync` | Batch upsert endpoint the Android app calls once it's back online, to push notes that were created offline. |

Every route except register/login/google requires `Authorization: Bearer <token>`.

## Running locally

```bash
cd backend
npm install
cp .env.example .env      # then fill in JWT_SECRET at minimum
npm run dev                # nodemon, restarts on file changes
# or: npm start
```

The API starts on `http://localhost:4000`. Test it:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Makhadzi Mambani","studentNumber":"22045871","email":"makhadzi@example.com","password":"password123"}'
```

## Deploying so it "exists on the internet"

This sandbox has no outbound network access, so it can't deploy this for you —
but any of these give you a free, public HTTPS URL in a few minutes:

**Render.com (recommended, free tier, easiest)**
1. Push this `backend/` folder to a GitHub repo.
2. Render dashboard → New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add the environment variables from `.env.example` under Settings → Environment.
5. Deploy. Render gives you a URL like `https://studyhub-sa-api.onrender.com` —
   use that as `BASE_URL` in the Android app's `RetrofitClient.kt`.

**Railway.app** works the same way and is just as quick.

⚠️ Free tiers on Render spin down when idle — the first request after a
while can take ~30 seconds to wake up. Fine for a PoE demo; mention it if
asked why the first login feels slow.

## Google Sign-In setup

1. Google Cloud Console → APIs & Services → Credentials → create an **OAuth
   2.0 Web application** client ID (not Android type — the web one is what
   the server verifies against).
2. Put that client ID in `.env` as `GOOGLE_CLIENT_ID`.
3. The *same* web client ID also goes into the Android app's
   `strings.xml` as `default_web_client_id` (see android README).

## AI Study Assist (Gemini) setup

The Summarize / Ask / Recommendations features work out of the box with a
local rule-based fallback — no setup required. To upgrade them to a real
Gemini-powered AI:

1. Get a free key at https://aistudio.google.com/apikey (no credit card
   needed for the free tier).
2. Add it to `.env` locally as `GEMINI_API_KEY=...` for local testing.
3. Add the same variable on Render: Dashboard → your service → Environment
   → Add Environment Variable → key `GEMINI_API_KEY`, value your key →
   Save Changes (triggers an automatic redeploy).

If the key is missing, invalid, or the Gemini API is temporarily
unreachable, every AI endpoint automatically falls back to the built-in
local logic — the feature never just breaks for the student.

## Push notifications setup

1. Firebase Console → Project Settings → Service Accounts → **Generate new
   private key**. Save the JSON as `backend/firebase-service-account.json`
   (already gitignored).
2. Set `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json` in `.env`.
3. Until this is configured, the server just logs a warning and skips
   sending pushes — everything else keeps working.
