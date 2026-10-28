# Current implementation and remaining work

Client booking/history/reschedule/cancellation, nutritionist calendar/manual booking/attendance, persistent client confirmation, in-app reminders and attention indicators are implemented against shared server-side Supabase access.

Four ordered migrations define isolated demo workspaces, appointment storage, normalized sample data, overlap prevention, confirmation/reminder fields and optimistic edit revisions. The database is authoritative; there is no in-memory booking fallback.

The readiness audit fixed stale edits, overly permissive phone normalization, unbounded streamed request reads, runtime configuration validation, unclear network errors and missing route error recovery. API Node runtimes, HTTP security headers and Node 24.x compatibility are explicit. The original design is retained.

Before release, configure the documented environment variables, apply migrations, run `test:live` against the real project, review populated browser/mobile/keyboard flows and set host-level abuse controls. See README for setup and `VERIFICATION.md` for the exact evidence boundary.

Real practice use additionally needs authentication with distinct staff/client permissions, an appropriate privacy/retention design and operational monitoring. Background reminders, paid messaging, AI features, real call links, payments and offline booking remain outside the implemented scope.
