# Kayro

A calm, mobile-first nutrition appointment demo. Next.js App Router, TypeScript, Tailwind and Supabase Postgres power a shared client experience and nutritionist calendar.

**Readiness:** local tests, production-server security checks and a production build have been verified. Live Supabase synchronization and populated browser/device acceptance remain unverified because database credentials were unavailable. This is a public **fictional assignment sandbox**, with no login or separate staff authorization. It is not suitable for real patient records.

## Local setup

1. Install Node **24.x** and run `npm ci`.
2. Create a dedicated Supabase demo project. Do not use a database containing real client information.
3. Apply the SQL migrations below in order.
4. Copy `.env.example` to `.env.local`, fill in the four required variables, then run `npm run dev`.
5. Open http://localhost:3000. Restart the server after changing environment variables. Missing or invalid configuration produces a setup message and HTTP 503, never a fake booking success.

```powershell
Copy-Item .env.example .env.local
npm run dev
```

## Environment variables

All four are **server-only**. Do not add a `NEXT_PUBLIC_` prefix. No browser Supabase key is required.

| Variable              | Value                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`        | Supabase project origin, e.g. `https://<project>.supabase.co`; no `/rest/v1` suffix                                 |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` API key, or a legacy JWT whose role is `service_role`. Publishable/anon keys are rejected.            |
| `DEMO_SESSION_SECRET` | Cryptographically random secret, at least 32 characters; keep it stable across deployments to preserve demo cookies |
| `APP_ORIGIN`          | Exact browser origin: `http://localhost:3000` locally; your public **HTTPS** origin on Vercel. No URL path.         |

Generate the signing secret locally:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never commit `.env.local`, expose secrets in browser code, or use a real secret in screenshots/logs. `.env.example` is intentionally blank. Both modern secret keys and legacy service-role keys bypass RLS, so they must stay on the server. [Supabase key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

## Database migrations and seed

For setup errors, run `npm run diagnose:db` locally (`npm run diagnose:db -- --production` to use production environment-file loading). It prints only configuration presence/validity and redacted check results, never credential values. With valid configuration it performs read-only table/column, RPC metadata and seed-prerequisite checks. It does not create a workspace, execute mutation RPCs, apply migrations or reset data. Schema checks are not proof of CLI migration-history entries; inspect the project migration history separately if needed. In `npm run dev`, deduplicated `[Kayro server diagnostic]` terminal logs identify the failing stage and safe provider error code; those logs are disabled in production and are never added to browser responses.

Run these files in Supabase SQL Editor **once each, in order**. Alternatively, initialize and link the Supabase CLI for a CLI-managed project, then run `supabase db push`. Use one migration workflow consistently; do not mix manual SQL execution with an unreconciled CLI migration history.

1. `supabase/migrations/202610280001_appointments.sql` — tables, indexes, exclusion constraint, timestamps, RLS and base booking rules.
2. `supabase/migrations/202610280002_sample_data.sql` — repeatable fictional assignment seed.
3. `supabase/migrations/202610280003_client_confirmation.sql` — persistent client confirmation/reminder dismissal and reset rules.
4. `supabase/migrations/202610280004_revision_guards.sql` — revision tokens and the guarded mutation RPC used by the app; refreshes the PostgREST schema cache.

For an existing installation, apply only migrations not already applied. Only the seed is designed for manual replay. Do not edit already-applied migration files or rerun schema migrations manually.

The canonical appointment interval is stored as `timestamptz`. Generated `appointment_date` and `appointment_time` columns display its **Asia/Kolkata (IST)** date and time without contradictory duplicate inputs. Rows include phone, service, practitioner ID, attendance, cancellation, confirmation, reminder dismissal, creation/update timestamps and a revision token.

The seed creates five template records and clones them into each new demo workspace. Replay does not duplicate records or reset edited workspace attendance. All records are historical; look under **Past** or dashboard **All dates**, not Today.

| Client      | Normalized phone      | IST date   | IST time | Original attendance |
| ----------- | --------------------- | ---------- | -------- | ------------------- |
| Riya Shah   | +919820011111         | 2026-10-24 | 10:00    | Booked              |
| Arjun Mehta | +919820022222         | 2026-10-24 | 11:30    | Booked              |
| Riya Shah   | +919820011111         | 2026-10-25 | 16:00    | Booked              |
| Meera Iyer  | Not provided (`NULL`) | 2026-10-23 | 09:00    | Done                |
| Kabir Rao   | +919820033333         | 2026-10-22 | 14:00    | No-show             |

Seed duration is 30 minutes because the assignment did not specify durations. Meera's phone is never invented. Past Booked records retain Booked attendance and are not presented as upcoming visits.

## Routes and features

| Route                           | Experience                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `/`                             | Next visit and unconfirmed reminders within 24 hours                                          |
| `/book`                         | Service → date/time → contact details → review → saved confirmation                           |
| `/appointments`                 | Upcoming and historical consultations                                                         |
| `/appointments/<id>`            | Details, confirm attendance, reschedule or cancel                                             |
| `/appointments/<id>/reschedule` | Change the existing appointment's time                                                        |
| `/book/confirmation/<id>`       | Saved booking details and attendance confirmation                                             |
| `/nutritionist`                 | Shared schedule, Today/All dates, confirmation labels, Needs attention and attendance changes |
| `/nutritionist/new`             | Manual booking through the same API and database rules                                        |
| `/dashboard`                    | Legacy redirect to `/nutritionist`; the old add-booking route also redirects                  |

Use IDs returned by the application, not the old `demo-1` fixture. Use the **same browser profile** for client and nutritionist views. Both read `/api/appointments` from the same Supabase tables. Successful writes update the UI; reads refresh every 15 seconds while visible and on return to the app. The practice calendar also has a refresh button. This is polling, not instantaneous Realtime delivery.

## Appointment rules

- Initial consultation: 45 minutes. Follow-up: 30 minutes. One fictional nutritionist, Maya Shah, with online sessions.
- Actual server time determines availability: today through 14 days ahead, Monday–Saturday, starting at `09:00`, `10:00`, `11:00`, `11:30`, `12:00`, `14:00`, `15:00` or `16:00`, if the full duration is free. Elapsed slots are disabled. All dates/times are explicitly IST, independent of browser timezone.
- A Postgres GiST exclusion constraint rejects overlapping non-cancelled intervals for the same workspace/practitioner. Adjacent intervals are allowed. Competing requests cannot both reserve an overlapping time, including different service durations.
- Attendance is exactly **Booked / Done / No-show**. Once a Booked appointment starts, the nutritionist can mark Done or No-show. These attendance outcomes are terminal. Historical Booked rows are not automatically changed.
- Cancellation sets `cancelled_at` separately; attendance remains Booked and the row stays in history. Its slot becomes available. Only future Booked visits can be cancelled or rescheduled.
- Rescheduling updates the same ID atomically. A conflicting move preserves the original reservation. A successful move releases the old slot and clears client confirmation and reminder dismissal so the new time can be reviewed.
- Client confirmation records intent to attend; it never changes attendance. Reminders appear in the open application for unconfirmed appointments within 24 hours. “Not now” persists a dismissal for that scheduled visit. Staff attention remains visible until the client confirms, reschedules, cancels or the visit starts.
- Every edit includes the revision last read by the client. Stale edits return 409 instead of overwriting another tab's newer changes. Refresh/review before retrying. A network failure can leave the result uncertain; check the appointment history before repeating the operation.
- New bookings require a 2–80 character name and a valid phone. Ten-digit Indian numbers become `+91…`; international numbers must include `+` and their country code. Import-only missing phones remain nullable.

No SMS, WhatsApp, email, push notification or reminder is sent when the app is closed. There is no offline booking queue, payment collection or real consultation call link.

## Public demo security model

Each visitor receives an isolated seven-day workspace in a signed HttpOnly, SameSite=Lax cookie (Secure on HTTPS). The demo intentionally allows that visitor to use both client and nutritionist functions on their own fictional workspace. Clearing cookies, expiry or changing the signing secret starts a new workspace. Both sides show all fictional records in that workspace, including seeds and manual bookings.

The browser never queries Supabase directly. The server verifies the cookie, injects its workspace, rejects cross-origin writes, validates bounded JSON bodies and enforces optimistic revisions. Tables have RLS enabled with no anon/authenticated policies; public table grants and RPC execution are revoked. Only the guarded RPC is granted to the server service role. Requests cannot supply a different workspace. API responses use `no-store`; the server key and signing secret are not present in browser bundles.

Each workspace is limited to 100 appointments and 60 successful changes per ten minutes. At most 2,000 live workspaces are admitted. Expired data is removed when a new workspace is created. These are resource bounds, not comprehensive anti-abuse protection: configure host/edge rate limiting before a broad public launch. Cookie possession grants access to that fictional workspace; there is **no actual staff/client identity boundary**. Real practice use requires authentication, role/ownership policies, a privacy/retention review and appropriate monitoring.

## Testing

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:http
```

- `npm test`: validation, dates, reminders, cookie signatures, SQL migrations, seeds, lifecycle, cancellation, rollback, revisions and role restrictions. Uses embedded PostgreSQL (PGlite) with `btree_gist`; no Supabase account needed.
- The native two-connection PostgreSQL race test is opt-in. Set `TEST_DATABASE_URL` to an **empty disposable database** with `anon`, `authenticated` and `service_role` roles already created. It applies migrations and must never target production or an existing project. Without this variable, that test is explicitly skipped.
- `npm run test:http`: requires a completed build. Starts/stops its own local production server using synthetic test-only configuration and an unreachable loopback database endpoint. Verifies routes, redirects, headers, cookies, origins, input bounds, revision validation and safe upstream failure. It does **not** verify live Supabase or browser interactions.
- `npm run test:live`: opt-in checks against a running, genuinely configured app. Creates fictional workspaces and exercises shared reads, booking/manual creation, confirmation, reschedule, cancellation, concurrency and visitor isolation. Original samples remain intact. Requires credentials to have already been configured in the app; the script itself does not read secrets.

```powershell
$env:KAYRO_TEST_ORIGIN = 'http://localhost:3000'
npm run test:live
```

Live verification has not passed in this environment because Supabase credentials were absent. SQL tests use dedicated historical fixtures for attendance changes and simulated elapsed time; they do not claim to wait through real consultations. See [verification evidence and remaining acceptance checks](docs/VERIFICATION.md).

## Vercel handoff

The repository pins Node 24.x, uses explicit Node.js API runtimes and standard Next.js build/start scripts. Vercel supports this Node version. [Vercel runtime reference](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

When you deploy yourself, use the **Next.js** preset, `npm ci`, and `npm run build`; leave the output directory at its framework default. Set the four server environment variables for the intended environment and use the exact HTTPS public origin in `APP_ORIGIN`. Configure preview origins separately if testing preview URLs; do not accept arbitrary origins or reuse production data in previews. Environment changes require a new deployment. No database migration runs during build; apply migrations separately first. There is no local file database or background worker in the deployed runtime.

Before public release: run the live HTTP verification; review booking/manual/status/confirmation flows in a populated browser; check narrow mobile layouts, keyboard focus and actual PWA installation; configure host rate limiting. No GitHub push, deployment or Vercel configuration was performed by this audit.

## Structure

`src/app/(client)/` contains client routes; `src/app/nutritionist/` contains practice routes. Shared presentation lives in `src/components/`. `src/lib/server/` is the server-only access layer; `src/lib/booking.ts` and `reminders.ts` contain shared rules. Database changes live in `supabase/migrations/`. PWA manifest/icons remain install foundations only; no service worker caches appointment data.
