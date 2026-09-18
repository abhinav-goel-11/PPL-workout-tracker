# PPL Tracker

A mobile-first tracker for a rolling 6-session Push / Pull / Legs body-recomposition split.

- **The queue never breaks.** "Next up" is derived from your last *completed* session, so rest
  days, abandoned sessions and backfilled logs can't knock the cycle out of order.
- **Logs in a basement gym.** Every set is written to a local queue first and replayed when
  signal returns; the server upserts on a unique slot, so replays can't duplicate anything.
- **Recomp metrics.** Weekly volume and sets by split, per-muscle breakdown, a streak that
  tolerates up to two rest days, and a bodyweight trend.

Next 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Drizzle · Neon Postgres · Auth.js v5.

---

## Setup

### 1. Database (Neon)

Create a project at [neon.tech](https://neon.tech) — or add Neon from a Vercel project's
**Storage** tab, which provisions it and injects the variables for you.

Two variables, both pointing at the same database:

| Variable | Endpoint | Used by |
|---|---|---|
| `DATABASE_URL` | pooled (host contains `-pooler`) | the app — `neon-http` opens a connection per query |
| `DATABASE_URL_UNPOOLED` | direct | migrations — DDL takes advisory locks a transaction pooler can drop |

Only `DATABASE_URL` is required; migrations fall back to it. Then create the tables:

```bash
npm run db:migrate
```

### 2. Auth secret

```bash
npx auth secret
```

This writes `AUTH_SECRET` into `.env.local`.

### 3. Google OAuth

In the [Google Cloud console](https://console.cloud.google.com/apis/credentials):

1. **Create an OAuth 2.0 Client ID** (type: Web application).
2. Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
   (add your production URL later).
3. Copy the client ID and secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

Sign-in only requests `openid email profile`. The calendar scope is requested **separately**,
from Settings — see below.

### 4. Run

```bash
npm run dev
```

Signing in seeds your own editable copy of the six PPL sessions.

---

## Google Calendar

`calendar.events` is a **sensitive** scope, so Google requires app verification before the
consent screen stops warning users. Two things to know:

- While the OAuth consent screen is in **Testing** status, Google **expires refresh tokens after
  7 days**. The integration will work all week and then quietly stop. Publish the consent screen
  (and submit for verification) to fix it permanently.
- Because consent is requested from Settings rather than at sign-in, none of this blocks the rest
  of the app. If access lapses, Settings shows a *Reconnect* card instead of erroring.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm test` | Unit tests (queue logic) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run db:generate` | Generate a migration from `schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio |

---

## How the rolling queue works

`getNextUp()` reads the newest `status = 'completed'` log and returns one ordinal after it.
That single rule covers every case:

| Situation | Result |
|---|---|
| Rest day logged | Cycle doesn't move — rest days are a separate table the queue never reads |
| Workout abandoned | Cycle doesn't move — only `completed` logs count |
| App closed mid-session | Resumes exactly where you left off |
| Backfilled an older date | "Next up" unchanged — the newest log still wins |
| Jumped ahead to Legs B | Next becomes Push A; the cycle simply continues from there |
| Deleted a mis-logged session | Self-corrects, because nothing is stored to go stale |

Sessions 5 and 6 are labelled "weekend expanded", but that is a duration estimate only — they
surface whenever the cycle reaches them, on any day.

## Deploying to Vercel

Adding Neon from the project's **Storage** tab provisions the database and sets `DATABASE_URL`
and `DATABASE_URL_UNPOOLED` for you. Three things it does *not* do:

1. **Create the tables.** Run `npm run db:migrate` once against the production database —
   provisioning gives you an empty one.
2. **Set the auth variables.** `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` live only
   in your local `.env.local`, which is never committed. Add them in Settings → Environment
   Variables.
3. **Register the production callback.** Add
   `https://<your-app>.vercel.app/api/auth/callback/google` to the Google client's authorised
   redirect URIs, or sign-in fails with `redirect_uri_mismatch`.

`AUTH_URL` is only needed if you use a custom domain; Vercel deployments infer the host.
