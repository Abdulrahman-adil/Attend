# Attend backend

The backend uses Express and SQLite. `app.js` assembles the middleware, controllers and routes; `server.js` loads the local configuration, opens an already migrated database, then starts listening. Importing either module does not start a server or open the application database.

## Local setup

Run these commands in the `backend` directory.

1. Run `npm install` if dependencies are not installed.
2. For a new environment, copy `.env.example` to `.env`. Preserve an existing `.env` and add missing settings to it instead of overwriting it.
3. Set `JWT_SECRET` and `OUTBOX_ENCRYPTION_KEY` using the generation commands in `.env.example`. Keep the outbox key stable so queued mail remains decryptable. The normal development origin is `http://localhost:5174`.
4. Prepare the database as described below.
5. Run `npm start` or `npm run dev`. Check `http://127.0.0.1:5001/api/health`; a ready instance returns `{"status":"ok"}`.

The default database is `backend/db/attendance.db`. Set `DB_PATH` to an absolute filename to use a separate database. Environment variables supplied by the shell override `.env`. `HOST` defaults to `127.0.0.1`; `PORT` defaults to `5001`.

## Database preparation

For a **new, empty database**, run `npm run db:migrate` to create its schema.

For an **existing database**, take a SQLite-consistent backup first, then run `npm run db:check`. Resolve reported integrity problems before running `npm run db:migrate`. A stopped application's database can be copied together with any WAL files; SQLite's backup API is preferable while it is in use. Startup refuses pending migrations and never applies them automatically.

If a legacy database has missing user references, use `scripts/repair-legacy-users.js` only after a backup and a rehearsal on a copy. It produces a read-only plan by default. With `--apply`, it preserves referenced user IDs using inactive, archived recovery accounts with generated archive-only emails; it never restores passwords or real email addresses. It optionally recovers a display name only when a historical source confirms both the user role and company. The script then migrates inside the same transaction and checks database integrity before committing.

Example rehearsal:

```sh
node scripts/repair-legacy-users.js --database /path/to/copy.sqlite --identity-source /path/to/historical.sqlite
node scripts/repair-legacy-users.js --database /path/to/copy.sqlite --identity-source /path/to/historical.sqlite --apply
DB_PATH=/path/to/copy.sqlite npm run db:check
```

## Tests

Run `npm test`. Tests exercise real HTTP routes, cookie sessions, CSRF checks, organization setup, invitations, work locations, attendance commands, tenant isolation, startup and shutdown. All records are synthetic. SQLite databases are in memory or in temporary directories, and email delivery is disabled. Local listening sockets are required.

## API wiring

| Area | Routes |
| --- | --- |
| Health | `GET /api/health` |
| Authentication | `POST /api/auth/register`, `/login`, `/activate`, `/invitation/inspect`, `/request-link`; `GET /api/auth/session`; `POST /api/auth/logout` |
| Organization setup | `POST /api/users/role` |
| Employees | `GET/POST /api/employees`; `POST /api/employees/:id/resend`; `DELETE /api/employees/:id` |
| Existing archival URL | `DELETE /api/users/users/:id`, using the same tenant-scoped archival handler |
| Locations | `GET/POST /api/locations`; `DELETE /api/locations/:id` |
| Attendance | `POST /api/attendance/check-in`, `/check-out`; `GET /api/attendance/dashboard`; `GET /api/attendance/:employeeId` |

Protected routes use the session cookie. Mutations also require the `X-CSRF-Token` returned by login/session. Attendance commands require `Idempotency-Key`; checkout additionally requires `attendanceId`. The old `/api/attendance/clock` route returns `409 CLIENT_UPGRADE_REQUIRED` after authentication instead of guessing a toggle action.

## Remaining integration work

This step repairs backend startup and route wiring. The existing React client still needs its request bodies, session handling and response parsing updated. Google endpoints return `503 GOOGLE_AUTH_UNAVAILABLE` until that integration is restored. Email is queued in the outbox, but its delivery worker is not started by this version. Setting `EMAIL_ENABLED=true` alone does not start delivery.
