# Kayro | Product documentation

Anand Dubey · AI Product Intern Assignment · 28 October 2026

## What we were asked

A nutritionist manages consultations through WhatsApp and Excel, but roughly one in four clients does not show up. She often finds out only when she is waiting for them. The brief asked for a polished, mobile-first client app and a nutritionist dashboard sharing the same appointment data, with booking, rescheduling, cancellation, attendance tracking and at least one feature addressing no-shows.

## Our approach

We built one responsive web product around a simple loop: book a visit, confirm the plan, and make changes easy before the consultation. Next.js, React, TypeScript and Tailwind provide the interface; Supabase Postgres stores appointments. Both sides use the same server-side API and database rules. Successful changes update the current screen, with shared data refreshed every 15 seconds while the app is visible and when it regains focus. Sage, warm neutrals and spacious layouts keep it closer to a wellness app than an admin panel.

## Decisions and assumptions

- **One mobile-first web app.** A link works on phones and laptops without an app-store installation or a separate native build. A manifest and icons provide PWA foundations; offline booking is not implemented.
- **Availability and conflicts.** We assumed one nutritionist, IST, 45-minute initial visits and 30-minute follow-ups. Clients choose from fixed Monday-Saturday slots, today through 14 days ahead. A database constraint rejects overlapping non-cancelled appointments within each demo workspace, even when requests arrive together. A failed reschedule keeps the old booking.
- **Sample data.** We explicitly converted the five supplied records to ISO dates, 24-hour IST times and consistent international phone notation. For example, 11:30am becomes 11:30, 4 pm becomes 16:00, and both Riya phone formats become the same +91 number. Historical appointments retain their original attendance statuses. The repeatable seed does not duplicate records.
- **Missing information.** Meera's phone remains SQL NULL and appears as "Phone not provided". We did not invent a number. Sample consultations use an assumed 30-minute duration.
- **Cancellation and attendance.** Attendance stays Booked, Done or No-show. Cancellation has its own timestamp, keeps the history and releases the slot. Only future Booked visits can move or be cancelled; once started, a Booked visit can become Done or No-show.
- **Public demo access.** A signed, HttpOnly cookie gives each visitor a seven-day fictional workspace shared by both interfaces. Server-only credentials, scoped requests and restricted public database access protect other visitors' records. This is not real client/staff authentication and is not intended for patient data.

## What we added

Clients can answer "Are we still on for your session?" with a confirmation stored separately from attendance. In-app reminders highlight unconfirmed visits within 24 hours; the dashboard's "Needs attention" section makes them visible to the nutritionist. Rescheduling clears the old confirmation so the new time can be checked. No messages or background notifications are sent when the app is closed. A Desktop / Mobile toggle shows the same interactive client app in a 390px phone frame, retaining typed booking details when switching views.

<!-- PAGE_BREAK -->

## What the AI got wrong (and how we caught and fixed it)

- **The setup error was too vague.** "Let's get you connected - Database setup required" made configuration failures look like database initialization failures. Inspecting the actual startup checks found a publishable key in the local server-secret variable. CLI checks later verified the hosted schema and four migrations; the more specific deployed message identified APP_ORIGIN failing the HTTPS rule. We added redacted diagnostics and field-specific errors, and provided the correct server-key and HTTPS-origin changes plus restart/redeploy instructions. The diagnostic fix is verified; final production recovery after the origin change was not independently rechecked.
- **Phone cleanup accepted malformed input.** The early sanitizer allowed a plus sign in the middle of a number and inferred country codes too freely. Code review caught this. We restricted the format, require a leading + for international numbers, and added tests rejecting embedded or repeated plus signs while preserving valid Indian-number normalization.
- **A stale tab could overwrite a newer edit.** The initial edit flow did not check whether an appointment had changed since it was read. Review identified this concurrency risk, rather than an observed data-loss incident. We added revision tokens and a guarded database operation; stale changes now return a conflict instead of overwriting the newer record. SQL tests verify the rejection and workspace boundaries.

The current local test run passed 31 tests and skipped the optional native PostgreSQL race test. Earlier two-connection checks passed. Mobile-preview layout, navigation, dialog containment and typed-field preservation were checked in Chrome using temporary fictional API responses, without database writes. A complete hosted Supabase booking lifecycle was not independently verified in this review.

## How to run it

1. Install Node 24.x. From the repository, run:

```sh
npm ci
```

2. Copy `.env.example` to `.env.local`. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (a server secret, not a publishable key), `DEMO_SESSION_SECRET` (random, at least 32 characters) and `APP_ORIGIN` (`http://localhost:3000` locally; the exact HTTPS origin when hosted). Keep all four server-only.

3. In a dedicated Supabase demo project, apply the files in `supabase/migrations/` once, in order: `202610280001_appointments.sql`, `202610280002_sample_data.sql`, `202610280003_client_confirmation.sql`, then `202610280004_revision_guards.sql`. Migration 002 contains the repeatable five-record seed. On an existing database, apply only missing migrations; do not reset it.

4. Start the app and open http://localhost:3000:

```sh
npm run dev
```

Use `/book` and `/appointments` for the client flow, and `/nutritionist` for the dashboard, in the same browser profile. Restart after changing local environment settings. Run `npm run diagnose:db` for redacted, read-only setup checks. Validation scripts are `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. The README covers optional HTTP/live checks and the demo's limitations.
