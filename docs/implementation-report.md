# Incremental security and dashboard implementation

Scope: SQLite, Express and React only. PostgreSQL and iOS work are deferred.
All tests use synthetic data and isolated databases. Existing user data is preserved.

## Phase 1: build baseline

- Replaced the invalid TypeScript project reference with complete application checking and a separate Vite configuration check.
- Enabled no-emit compilation, modern DOM/ES libraries, strict checking, and filename case checks.
- Corrected the unsafe activation error access.
- Validation: `npm run build` passed, including both TypeScript configurations and Vite production bundling.

## Invitation and activation audit before dashboard changes

Verified in `backend/controllers/employeeController.js`, `authController.js`, `services/emailService.js`, and the manager components:

1. A manager supplies an employee email AND password. The server creates an inactive account and emails that password plus an activation link.
2. The original token has 20 cryptographically random bytes, is stored in plaintext, and expires after one hour.
3. Activation reads the token then updates the account in separate operations. The token is cleared after use, but simultaneous activations are not protected by a transaction/conditional consume.
4. A second opening after completion or an expired link receives an invalid/expired error. There is no resend flow, and re-registration collides with the existing email.
5. Contrary to the reported approximate flow, successful activation sends NO confirmation email and writes NO audit event.
6. Email exceptions are swallowed inside the service. Creation can claim delivery when nothing was sent; no durable delivery/retry state exists.
7. Email uniqueness is case-sensitive. The manager employee endpoint returns only id/name/email, and the roster only refreshes after local employee-create events. Activation in another browser does not update it.
8. Activation links use FRONTEND_URL with a localhost fallback. Tokens are in the URL fragment (not normal HTTP access logs/referrers), but are visible to page scripts/history. The external runtime CSS script should be removed.

## Dashboard data map and proposed structure

Existing endpoints: GET /api/employees (roster), /api/locations (sites), /api/attendance/:employeeId (history), and /api/attendance/dashboard (single employee). None provides a manager overview, server clock, weekly aggregates, or activation events.

Proposed manager layout:
- Organization header, named greeting, organization-local date, server-anchored display clock, freshness indicator, refresh/invite controls.
- Cards for total/active/pending employees, distinct employees checked in today, currently checked in, checked out today, not checked in, and attendance percentage.
- Seven-day chart of distinct employees with check-ins, recent attendance activity and activations.
- Pending invitations, employees not yet checked in, delivery/configuration alerts, roster/report/location quick actions.
- Separate employee management, attendance report/export, worksite and timezone settings views.
- Honest loading, empty, failure/retry, stale-data, and success states. Semantic controls, focus styles, accessible chart data, reduced-motion support.

Late, absent, and leave counts are unavailable: there are no shifts, expected workdays, grace periods, holidays or leave records. They will be hidden, not invented. Not-yet-checked-in does not mean absent. The initial seven-day chart uses actual distinct check-in counts; historical activation dates will not be fabricated.

## API, database, timezone and refresh decisions

- Add a tenant-scoped GET /api/manager/dashboard aggregate, bounded roster/history APIs, invitation resend, and a bounded CSV report export.
- Add SQLite migrations for invitations, sessions, audit events, attendance request idempotency, email delivery outbox, integrity enforcement, indexes, retirement timestamps and organization timezone.
- Existing companies receive an explicit UTC default with a setup alert until a manager configures an IANA timezone. New companies also explicitly select/confirm a timezone. Never infer a business timezone from the device.
- Server UTC is authoritative. Organization-local day boundaries handle DST. The live clock advances a returned server timestamp with performance.now(), not Date.now().
- One dashboard fetch on entry, explicit action invalidation, and non-overlapping 30-second polling while visible/online. Pause background tabs, back off errors, revalidate on visibility/reconnect, and retain stale results with clear warnings. This gives cross-browser activation visibility within one polling interval without the operational overhead of sockets.
- Invitation acceptance consumes a hashed token atomically, allows the employee to set a password, records one activation audit event, and schedules one confirmation per intended recipient using unique outbox event keys.
- SMTP is at-least-once delivery: a provider accepting an email just before a worker crash cannot be guaranteed exactly once by SMTP. Stable message IDs and unique outbox events reduce duplicates; document this boundary rather than promise exactly-once external delivery.
- Old JWTs will be invalidated by signing-secret rotation and session-backed authentication. Old attendance toggle requests will be rejected with an upgrade response; the new UI uses explicit commands.
- Migrations never silently remove duplicate/orphan data to satisfy constraints. If incompatible existing rows are detected, migration rolls back with a repair-required report. Take an operational backup before applying to an existing database.

External provider credentials: the user will revoke/rotate SMTP, Google and tooling API keys at their issuing providers and save replacements locally. Local JWT rotation and Git untracking are handled here. Provider revocation cannot be verified from repository edits.
