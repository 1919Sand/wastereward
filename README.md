# WasteReward — Phase 1

A mobile-friendly family dashboard for WasteReward.

## Included

- Google Login with Supabase
- Family profile
- Points
- Monthly calendar
- Daily status
- Current/best streak
- Next reward progress
- Recent point activity
- Admin-created household claiming after Google sign-in
- Demo mode, so the UI runs before Supabase is configured

## Run locally

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Demo mode

If `.env.local` is missing or Supabase values are empty, the app automatically shows the Anju Arora demo family from `lib/demo-data.ts`.

### Enable Supabase and PostgreSQL

Supabase provides Google authentication and PostgreSQL. The regular dashboard never loads another household's data and does not show household-management controls.

1. Create a Supabase project.
2. In its SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. In Authentication → Providers, enable Google and add your Google OAuth client ID and secret.
4. Add `http://localhost:3000` and your production URL to Authentication → URL Configuration.
5. Copy `.env.local.example` to `.env.local`; add your Project URL, anon key, service-role key, and administrator emails.
6. Restart `npm run dev`.

In `/admin`, create each household with its family name, house number, and unique WasteReward ID. On a member's first sign-in, they enter their house number and WasteReward ID to claim that household. On later sign-ins, their own dashboard loads directly.

The `families` table is linked to a member's Google account only after the household is claimed.

Example document:

```json
{
  "id": "WR001",
  "familyName": "Anju Arora",
  "houseNo": "1171-D",
  "society": "ABC Society",
  "points": 120,
  "currentStreak": 24,
  "bestStreak": 24,
  "rank": 1,
  "nextReward": {
    "name": "Movie Ticket",
    "pointsRequired": 200
  },
  "history": [
    {
      "date": "2026-09-15",
      "reason": "Daily waste submission",
      "points": 5
    }
  ],
  "days": {
    "2026-09-15": "completed",
    "2026-09-16": "future"
  }
}
```

### Admin operations

The protected admin panel is at [http://localhost:3000/admin](http://localhost:3000/admin). It creates unclaimed households and manually adds or deducts points. It is intentionally separate from the member dashboard.

To activate it, add these server-only values to `.env.local`:

- `ADMIN_EMAILS`: comma-separated Google email addresses permitted to use `/admin`.
- `SUPABASE_SERVICE_ROLE_KEY`: find this server-only key in Supabase Project Settings → API.

Never use a `NEXT_PUBLIC_` prefix for the service-role key and never commit `.env.local`. The admin gives each household a short ID such as `WR101`; the member claims it once using that ID and their house number. Every manual point change is written to `point_transactions`.
