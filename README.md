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

In `/admin`, create each household with its family, contact, address, and optional referral details. The admin receives an expiring one-time claim code. On a member's first sign-in, they use that code and their WasteReward ID while signed in with the registered Google email. On later sign-ins, their own dashboard loads directly.

If this project was already deployed using an earlier schema, run [`supabase/dashboard-update.sql`](supabase/dashboard-update.sql) once. It adds the profile fields, repairs duplicate same-day point records, and enforces one replaceable point entry per family per day. Then run [`supabase/leaderboard-update.sql`](supabase/leaderboard-update.sql) to enable scoped monthly leaderboards.

Run [`supabase/location-leaderboard-update.sql`](supabase/location-leaderboard-update.sql) afterward to let members opt into a 5 km Nearby leaderboard. Browser coordinates are rounded to two decimal places before storage; members who do not grant location permission continue using the PIN-code leaderboard.

Finally, run [`supabase/production-hardening-update.sql`](supabase/production-hardening-update.sql). It enables expiring one-time household claim codes, preserves the source of Green Pause balances during corrections, records an administrator audit trail for point changes, and records the applied schema version. Run the four update files in the order listed here; new databases can use `supabase/schema.sql` directly.

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
