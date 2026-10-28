# Production-readiness audit — 28 October 2026

## Verified locally

- ESLint, explicit TypeScript checks and a standard Next.js production build passed without database credentials. Node 24.x is declared in package and lockfile metadata.

- Reviewed the client/provider/API path and the nutritionist path: both use the same scoped server API, not separate mock stores.
- All SQL migrations applied in embedded PostgreSQL and in an empty native PostgreSQL 18 test database.
- Local suite: 30 passing tests with the native race test enabled. Standard runs without `TEST_DATABASE_URL` pass 29 and explicitly skip that race test.
- Booking, database overlap prevention, atomic reschedule rollback, cancellation release, attendance transitions and persisted client confirmation/dismissal covered by SQL tests.
- Separate native connections compete for a slot: one reservation wins. Stale confirmation after rescheduling is also rejected.
- Guarded RPC tested as `service_role`: booking, confirmation, reschedule, cancellation, fresh attendance reads, revision conflicts, cross-workspace denial and denial of unguarded RPC access.
- Original sample records checked for exact normalized dates/times/phones/statuses. Meera remains null; samples remain intact during the new lifecycle tests.
- IST date boundaries, past appointments, rolling dates, working slots, reminder window boundaries, multiple reminders and dismissal behavior covered by unit tests.
- Configuration validation rejects unsafe origins, weak signing secrets and public API keys; JSON tests bound streamed bytes even without Content-Length.
- Production HTTP checks pass for application routes, redirects, security headers, missing/forged cookies, hostile origins, malformed/oversize requests, missing revision tokens and safe database-unavailable responses. These checks use an unreachable loopback test endpoint, not a Supabase emulator.
- Production dependency audit reports zero known vulnerabilities at audit time.
- Built browser JavaScript/JSON/map assets scanned: no `sb_secret_`, `SUPABASE_SECRET_KEY` or `DEMO_SESSION_SECRET` markers found. This is a targeted scan, not a guarantee against every possible credential leak.

## Not verified

No `.env.local` or live Supabase credentials were available. Hosted Supabase REST/RPC behavior, hosted grants/RLS, network access and real client-to-dashboard synchronization have not been exercised. `test:live` is provided for that acceptance check.

Populated browser interactions, rendered desktop/mobile layouts, keyboard focus, screen-reader behavior and real PWA installation have not been verified in this audit. CSS and accessibility structure were inspected in code; that is not equivalent to device/browser QA. No alternate browser automation bypass was used after the earlier Computer Use policy stop.

The build is suitable for the existing fictional public sandbox architecture. It is not approved for real patient data: identity authentication and separate staff/client authorization do not exist. Hosting anti-abuse controls and live acceptance checks remain release prerequisites. No deployment, push or remote configuration was performed.
