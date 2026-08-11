# Trip HQ

A private trip planner for two people: London → Scotland → an artist residency,
with a side trip to Beijing and the flights home to San Mateo.

It does three things:

1. **One timeline.** Flights, stays, car hire, trains and notes in one list,
   grouped by day and by leg of the trip, each shown in its own local timezone.
2. **Per-person view.** Filter to just one traveler for the stretch where you're
   in different countries.
3. **Email ingestion.** Forward a booking confirmation to a dedicated address and
   Claude reads it into structured segments, which wait in a review queue until
   you confirm them.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Postgres via Drizzle ·
Anthropic API for parsing · deploys to Vercel.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:push              # create the tables
npm run dev
```

### Environment variables

| Variable | What it's for |
| --- | --- |
| `DATABASE_URL` | Any Postgres connection string. [Neon](https://neon.tech)'s free tier is plenty; Vercel Postgres works too. |
| `APP_PASSCODE` | The shared passcode you both type once per device. |
| `AUTH_SECRET` | Signs the session cookie. `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | Used to parse forwarded booking emails. |
| `INBOUND_WEBHOOK_SECRET` | Shared secret the email webhook must present. `openssl rand -hex 24` |

## Deploying to Vercel

```bash
npx vercel link
npx vercel env add DATABASE_URL production      # repeat for each variable above
npx vercel --prod
```

Or import the repo at [vercel.com/new](https://vercel.com/new) and paste the same
five variables into the project's environment settings.

Run `npm run db:push` once against the production database before the first
visit — Drizzle applies the schema in `src/lib/db/schema.ts` directly. The
generated SQL also lives in `drizzle/` if you'd rather apply it by hand.

## Setting up the email address

The webhook at `POST /api/inbound/email` is deliberately provider-agnostic — it
understands Postmark, Resend, SendGrid, and a plain JSON post from a Cloudflare
Email Worker. Point whichever you prefer at:

```
https://<your-app>.vercel.app/api/inbound/email?token=<INBOUND_WEBHOOK_SECRET>
```

**Postmark** is the least work: it hands you a free address like
`abc123@inbound.postmarkapp.com` with no domain required. Create a server, open
the inbound stream, and paste the URL above as the webhook. Forward confirmations
to that address and they'll show up under **Review** within a minute.

If you already own a domain, Cloudflare Email Routing plus a small Worker gives
you a nicer address (`trips@yourdomain.com`) that forwards to the same endpoint.

Check the wiring any time by opening the URL above in a browser — a `GET`
with the right token returns `{"ok":true}`.

### How parsing works

The webhook stores the raw email first, acknowledges immediately, then parses in
the background — booking confirmations survive even if the model call fails, and
the **Review** screen has a re-parse button for anything that went wrong.

Claude returns local wall-clock times plus an IANA timezone rather than UTC, and
the conversion happens here against a real timezone database. Confirmation emails
state local times, so this avoids a whole category of off-by-an-hour bugs.

Nothing from email lands on the timeline automatically. Parsed segments sit in
the review queue until you confirm them, so a misread never quietly corrupts the
itinerary.

## Making it yours

`src/lib/config.ts` is the file to edit as plans firm up:

- **Traveler names** — currently "Xiao" and "Husband".
- **Legs** — London, Scotland, Residency, Beijing, Home. Their `start`/`end`
  dates are mostly `null` (still TBD); fill them in and the timeline groups
  segments under the right heading automatically.
- **Milestones** — the countdown cards. Residency ends 24 Sep 2026 and the flight
  home is 25 Sep 2026.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:push` | Apply the schema to `DATABASE_URL` |
| `npm run db:generate` | Regenerate the SQL in `drizzle/` after a schema change |
