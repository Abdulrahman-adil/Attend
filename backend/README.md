# Attend backend

Production uses PostgreSQL and the existing Google Identity Services login, Express, and database-backed JWT sessions. SQLite is an optional development dependency for explicitly invoked legacy/recovery tools, never server startup.

## Configuration and commands

Use Node 22 or later. Install with `npm ci`; production installs can use `npm ci --omit=dev`. Preserve existing environment configuration. See `.env.example` and [the deployment procedure](../docs/postgres-deployment.md).

- `npm run db:check`: read-only PostgreSQL schema/version inspection.
- `npm run db:migrate`: explicit transactional migrations for a new empty or already tracked PostgreSQL schema.
- `npm run db:baseline`: explicitly adopt an existing untracked baseline after catalog checks, then apply additive migrations.
- `npm run admin:bootstrap`: promote an existing active Google-authenticated account selected by operator environment configuration; refuses if any admin exists.
- `npm start`: validate schema then serve HTTP; never migrate.
- `npm test`: unit/protocol tests; no database or external Google/Resend calls.
- `npm run test:postgres`: integration tests in fresh random schemas of an explicitly configured dedicated PostgreSQL test database. Without TEST_DATABASE_URL these tests are skipped, not passed.
- `npm run test:legacy`: isolated in-memory SQLite migration/schema tests.
- `npm run legacy:check` and `npm run legacy:migrate`: existing SQLite commands, only on an actual backed-up legacy database.

The legacy repair script remains offline and unchanged. It can create synthetic recovery identities and MUST NOT be used for this migration. No SQLite import or data cleanup is performed by the PostgreSQL commands.

## Authentication

The frontend Google button obtains a credential and submits JSON to POST /api/auth/google. The backend verifies Google's signature/issuer/expiry/audience through google-auth-library and requires a verified email. The old Passport redirect endpoints remain unavailable; there is no active callback URL or authorization-code/state exchange. Do not wire the unused Passport module back into production.

Existing password login, activation, and password reset remain available. Password reset revokes database sessions while retaining an existing Google identity link.

Web sessions use the production cookie __Host-attend_session (Secure, HttpOnly, Path=/, no Domain, SameSite=None), an eight-hour JWT and a required session lookup. Cookie mutations require the returned X-CSRF-Token. Mobile Google login retains its bearer-token response. Roles and active/archive status are read from the database on authenticated requests.

Authentication requests reject foreign Origin headers and non-JSON login requests. A bounded per-process limiter covers login/registration/link requests; proxy addresses are not blindly trusted. Behind a reverse proxy, the IP limit may be shared. Verify edge rate limiting and legitimate traffic capacity before release.

## Outbox

Mail is encrypted with AES-256-GCM and sent through Resend HTTPS. Jobs are claimed with row locks and SKIP LOCKED, expire correctly with PostgreSQL timestamps, retry with backoff, and stop after five attempts. Lease attempt checks prevent stale workers from overwriting a newer claim. Requests have a 20-second timeout and a stable provider idempotency key; external delivery is not an exactly-once guarantee. Shutdown stops further claims and waits for the current drain before closing the pool.

The worker starts immediately and polls every 30 seconds only while the web service is running. A sleeping free service cannot guarantee background delivery. With EMAIL_ENABLED=false, mail remains queued, so public password registration/activation requires a delivery arrangement.

Read-only operational checks:
```sql
SELECT status, count(*) FROM email_outbox GROUP BY status;
SELECT min(created_at) FROM email_outbox WHERE status='pending';
SELECT count(*) FROM email_outbox WHERE status='failed';
```

No automatic retention deletion or failed-message reset is added. Review retention and retry decisions separately, preserving historical records and the encryption key.
