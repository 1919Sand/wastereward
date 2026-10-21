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
- Complete family/contact/address profiles, referrals, and nearby families
- Green Pause and referral-earned pause tracking
- Previous-month summaries and a rolling seven-day activity view
- Reward rules page
- Month-specific points and rankings that follow the selected calendar month
- PIN-code, city, state, and India monthly leaderboards
- WhatsApp interest and referral-sharing journeys
- Admin-created household claiming after Google sign-in
- Demo mode, so the UI runs before Supabase is configured

## Run locally

Requirements: Node.js 20.9+; Node.js 22 LTS is pinned in `.nvmrc` for the VM.

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

In `/admin`, create each household with its family, contact, address, and optional referral details. The admin receives an expiring one-time claim code. On a member's first sign-in, they use that code and their WasteReward ID. If an email was entered for the household, they must sign in with that Google email. On later sign-ins, their own dashboard loads directly.

If this project already has a Supabase database, run only [`supabase/production-hardening-update.sql`](supabase/production-hardening-update.sql) in the SQL Editor. This standalone, repeat-safe update adds any missing family/address/location columns, repairs duplicate same-day point records, enables leaderboards and claims, and installs the point audit protections. New databases can use `supabase/schema.sql` directly.

After the update finishes, run [`supabase/verify-production.sql`](supabase/verify-production.sql). The migration and function checks should be true, and duplicate dates, invalid statuses, and invalid locations should be zero. Investigate any point-total mismatch before going live.

The Nearby leaderboard uses browser geolocation and stores coordinates rounded to two decimal places. It does not require a Google Maps API key. It refreshes automatically every 30 seconds, as do the other monthly leaderboard scopes.

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

The protected admin panel is at [http://localhost:3000/admin](http://localhost:3000/admin). It creates unclaimed households and saves Completed, Missed, or Green Pause daily entries. Saving the same family and date replaces the earlier entry, preventing duplicate point totals. It also provides the family's current total and day-by-day history.

To activate it, add these server-only values to `.env.local`:

- `ADMIN_EMAILS`: comma-separated Google email addresses permitted to use `/admin`.
- `SUPABASE_SERVICE_ROLE_KEY`: find this server-only key in Supabase Project Settings → API.
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: the WasteReward WhatsApp onboarding number in international format with digits only. It defaults to `919509925939`; override it here if the number changes. “Get Started” opens the interest form, where this WhatsApp shortcut appears above the form.

Never use a `NEXT_PUBLIC_` prefix for the service-role key and never commit `.env.local`. The admin gives each household a short ID such as `WR101` and an expiring one-time claim code. Every manual point change is written to `point_transactions` and its administrator audit trail is written to `admin_point_audit`.

## Production release

Apply the database migration before deploying code that uses the new columns:

1. In Supabase SQL Editor, run `supabase/production-hardening-update.sql`.
2. Run `supabase/verify-production.sql` and review every result.
3. Push the reviewed code to the deployment branch.
4. On the VM, pull with a fast-forward, install the lockfile exactly, verify, build, and restart the service:

```bash
git pull --ff-only
npm ci
npm run check
sudo systemctl restart wastereward
curl --fail https://wastereward.in/api/health
```

The health endpoint returns HTTP 200 with `"status":"ok"` only when the application can reach Supabase and migration `20261021_production_ready` is recorded. A 503 response means the VM credentials, database connection, or migration still needs attention.
