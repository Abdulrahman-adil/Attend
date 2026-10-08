# PostgreSQL deployment procedure

## Scope and verification boundary

The authoritative baseline remains backend/db/postgres-migrations/001-initial.sql, unchanged. Migration 002 adds integrity constraints and indexes without deleting or rewriting records. Existing incompatible rows stop the transaction; they are not repaired or replaced. No production database has been connected or changed during this implementation.

VERIFIED LOCALLY means code/schema inspection, unit tests, or build checks. PostgreSQL execution, data compatibility, external credentials, real Google login and browser cookie acceptance remain EXTERNAL VERIFICATION REQUIRED until tested in those environments.

## Database preparation — operator action, not startup

1. Back up the actual PostgreSQL database using the provider-supported process. Obtain a schema-only export and compare it with the baseline. Preserve all historical user references.
2. Set DATABASE_URL only in secure local/operator configuration or the Render environment. Do not paste credentials into chat, logs, commands committed to source, or the frontend.
3. Run npm run db:check from backend. It checks tracked versions/checksums and required catalog objects. An unversioned baseline is expected to fail version checking.
4. For a genuinely empty schema run npm run db:migrate. For an existing manually created baseline, review definitions/defaults/constraints in the schema export, then explicitly run npm run db:baseline. The catalog guard detects missing/type/nullability/identity/default-presence/constraint/index/trigger problems but is not a proof that every expression or trigger body matches the baseline.
5. Run npm run db:check again. Re-running db:migrate against current tracked migrations is a no-op. Changed or unknown history is rejected.
6. Start the server only after successful checking. Startup and /api/health verify readiness without applying migrations.

A schema_migrations ledger records the version, filename, checksum, and application time. Migration/adoption runs inside a transaction with a PostgreSQL advisory lock. Migration 002 validates owner uniqueness, required owners, normalized email, attendance/employee/location tenant references, checkout coordinates, session expiry, and radius bounds. A failure rolls back the entire command.

No SQLite database or backup is available here. There is no automatic import. A future import requires an actual backup, a reviewed mapping of historical identities and foreign keys, reconciliation counts, sequence advancement, and a rehearsal. Never run repair-legacy-users.js to fabricate replacement identities.

## Initial administrator

1. Deploy the existing Google credential flow with correctly configured Google client IDs.
2. The intended person signs in using their legitimate Google account; new accounts receive the ordinary employee role and can follow existing organization onboarding.
3. An authorized database operator verifies that person's existing active users row and Google subject. Set INITIAL_ADMIN_GOOGLE_SUB in private operator environment configuration, then explicitly run npm run admin:bootstrap.
4. The command uses the existing account, refuses if any administrator already exists, locks the bootstrap operation, promotes that row, and writes an audit event. It creates no account and has no public bootstrap endpoint.
5. Remove INITIAL_ADMIN_GOOGLE_SUB afterwards. Refresh the session to obtain the current role.

This requires authorized operator database access at deployment time. It does not require a Render paid shell: run the command from a trusted operator machine with appropriate provider connectivity. No bootstrap operation was run in this task. No DevelopmentAdmin was added.

## Render / network — EXTERNAL VERIFICATION REQUIRED

- Frontend remains https://app.vaniillaa.com.
- Discovered backend remains https://attend-api-f60m.onrender.com; the frontend API base is https://attend-api-f60m.onrender.com/api.
- No DNS change, custom backend domain, reverse proxy, or topology change is implemented.
- Verify the deployed repository revision, frontend build output, backend root directory, Node version, build/start commands, HOST=0.0.0.0, assigned PORT and /api/health.
- Set NODE_ENV=production and FRONTEND_URL=https://app.vaniillaa.com exactly. Configure DATABASE_URL, JWT_SECRET (at least 32 bytes), OUTBOX_ENCRYPTION_KEY (32 random bytes in base64), GOOGLE_WEB_CLIENT_ID, and optional mobile audiences.
- When mail is enabled, configure EMAIL_ENABLED=true, RESEND_API_KEY and a verified EMAIL_FROM sender. Retain the encryption key for pending mail.
- Verify provider TLS requirements and certificate validation. pg supports connection-string TLS settings; never disable certificate verification as a workaround.
- Current free Render Postgres expires after 30 days; it cannot be treated as an indefinitely free production database. Free web services sleep and do not provide continuous outbox execution. Provider limits and an enduring database/backup arrangement must be confirmed externally: https://render.com/docs/free.
- Confirm edge abuse protection. The in-process limiter is bounded and deliberately does not trust arbitrary forwarding headers; it is not a distributed quota system.

## Google Console — EXTERNAL VERIFICATION REQUIRED

Set the real Web client ID as backend GOOGLE_WEB_CLIENT_ID and frontend build-time VITE_GOOGLE_WEB_CLIENT_ID. They must match. Register https://app.vaniillaa.com as an authorized JavaScript origin, and verify the consent screen/publication/test-user settings applicable to the Google project. Optional mobile client audiences must belong to the intended application.

The active GIS credential flow uses POST /api/auth/google, not the dead Passport callback. Do not invent a callback URL or set GOOGLE_CLIENT_SECRET for this flow. Signature/audience/expiry and verified-email behavior has unit coverage with mocked verification; real Google issuance and Console settings have not been verified.

## Browser sessions — EXTERNAL VERIFICATION REQUIRED

Production retains Secure, HttpOnly, SameSite=None, Path=/ and no Domain with the __Host-attend_session name. None is intentional because app.vaniillaa.com and onrender.com are cross-site. CORS permits only the configured frontend origin with credentials. All browser session requests include credentials; authenticated mutations send the session's CSRF token.

Test real Google login, session restoration after reload, CSRF rejection, expiry, logout/reload, inactive accounts and both supported browser privacy modes on the deployed domains. Successful password and Google web login responses establish the in-memory bearer session immediately. There is no second cookie confirmation request after login. On refresh, the frontend attempts cookie-based restoration; an initial 401 means no existing session and does not describe the result of a later login attempt.

Browser third-party-cookie blocking can still prevent persistence. If target browsers block these cookies, reliable cross-site sessions remain a deployment blocker under the retained topology. A custom domain/proxy would require a separate authorized deployment decision; neither is implemented here.

## Tests and installation

Production integration tests accept only TEST_DATABASE_URL naming attend_test or attend_test_*. Each creates and later drops its own random attend_test_* schema; they never fall back to DATABASE_URL. Fixtures exist solely inside these isolated schemas. Use a dedicated least-privileged test role with no production access. Integration tests include explicit schema migrations, concurrency, tenant foreign keys, Google account creation (mock identity verification), sessions, invitations and attendance.

Repository node_modules contains tracked, incomplete dependencies. For this implementation, dependencies and builds were isolated in the ignored .verification copy; tracked node_modules was not modified. A fresh dependency install is required for normal local execution. The SQLite native-install allowance exists only in that ignored copy and is not production configuration.

Node 22+ is required. Canonical commands: npm test, npm run test:postgres, npm run test:legacy in backend; npm run build at the frontend root. Real PostgreSQL tests are skipped when no TEST_DATABASE_URL is configured. A passing unit suite or frontend build does not constitute PostgreSQL integration or production verification.


## Auth follow-up to 21434b9 (2026-10-08)

VERIFIED LOCALLY:

- The reported `Please sign in.` response originates before JWT/database validation when neither an accepted cookie nor bearer token is present. This alone cannot distinguish failed login, refresh without a cookie, or a normal unauthenticated initial load.
- Regression tests against 21434b9 reproduced five failures: password and Google immediate requests through a previously captured API helper omit the new bearer token; restoration reparses a valid semicolon-separated cookie header incorrectly when there is no space; failed logout clears local state; restoration network failures escape as unhandled rejections. These are reproduced code defects, not proof that any one caused the reported production incident. Normal dashboard rendering after login may already obtain the updated helper in 21434b9.
- The API helper now reads current in-memory credentials synchronously. No browser storage persistence was added. Restoration returns the exact token already authenticated by middleware. Logout retains the local session on network/server failure, allowing retry; successful revocation or an already unauthenticated response clears it.
- Secure, HttpOnly, SameSite=None, host-only cookie scope, CSRF, exact configured CORS origin, session hashing, PostgreSQL runtime and tenant queries remain intact. No schema, dependency, environment, account or deployment change was made.
- Tests ran inside the ignored `.verification` copy: `node --test tools/auth-context.test.cjs backend/tests/unit/*.test.js` passed 20 tests. The frontend tests execute the actual provider with a hook harness, not a real browser. HTTP tests use an in-memory store double and mocked Google identity, not PostgreSQL or real accounts.
- `node --test backend/tests/*.test.js backend/tests/legacy/*.test.js` passed the single legacy migration test; 15 PostgreSQL tests were skipped with no test database configured. TypeScript checks for both tsconfig files and Vite production build passed (61 modules).

EXTERNAL VERIFICATION REQUIRED:

- Incident classification A/B/C/D requires a real browser trace. Record only request statuses, initiators, and presence (never values) of credentials: POST `/api/auth/login` or `/google`, dashboard GET, and `/auth/session` before/after refresh. A startup session 401 is expected when signed out. Check the browser's Set-Cookie rejection explanation and whether the refresh request includes the cookie.
- Verify deployed frontend/backend revisions, Render `FRONTEND_URL=https://app.vaniillaa.com`, HTTPS, credentialed preflight, Google client audience/origin configuration, and real PostgreSQL session insertion/revocation. No external settings were changed or deployment triggered manually.
- Existing employee, newly activated employee, existing admin, real Google login, real dashboard navigation, tenant isolation and logout/reload require real integration/browser verification. New account activation and tenant tests remain skipped, not passed.
- The backend remains `https://attend-api-f60m.onrender.com`; frontend remains `https://app.vaniillaa.com`. If the browser blocks third-party cookies, refresh cannot recover a token that exists only in page memory. This remains a deployment decision/blocker; these fixes do not override browser privacy policy or introduce a custom domain/proxy.
