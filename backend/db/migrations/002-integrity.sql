ALTER TABLE users ADD COLUMN normalized_email TEXT;
ALTER TABLE users ADD COLUMN created_at TEXT;
ALTER TABLE users ADD COLUMN invited_at TEXT;
ALTER TABLE users ADD COLUMN activated_at TEXT;
ALTER TABLE users ADD COLUMN archived_at TEXT;
ALTER TABLE companies ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE companies ADD COLUMN timezone_configured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE locations ADD COLUMN retired_at TEXT;
ALTER TABLE attendance ADD COLUMN company_id INTEGER REFERENCES companies(id);
UPDATE users SET normalized_email = LOWER(TRIM(email));
UPDATE attendance SET company_id = (SELECT company_id FROM users WHERE users.id = attendance.employee_id);
CREATE UNIQUE INDEX users_email_normalized ON users(normalized_email);
CREATE INDEX users_company_role ON users(company_id, role, archived_at, is_active);
CREATE INDEX locations_company ON locations(company_id, retired_at);
CREATE INDEX attendance_employee_time ON attendance(employee_id, check_in_time DESC, id DESC);
CREATE INDEX attendance_company_time ON attendance(company_id, check_in_time DESC, id DESC);
CREATE INDEX attendance_company_checkout ON attendance(company_id, check_out_time);
CREATE UNIQUE INDEX attendance_one_open ON attendance(employee_id) WHERE check_out_time IS NULL;
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT
);
CREATE INDEX sessions_user ON sessions(user_id, revoked_at);
CREATE TABLE invitations (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
 company_id INTEGER REFERENCES companies(id), token_hash TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('invitation','activation','password_reset')),
 created_at TEXT, expires_at TEXT NOT NULL, consumed_at TEXT, revoked_at TEXT,
 created_by INTEGER REFERENCES users(id)
);
CREATE UNIQUE INDEX invitations_one_pending ON invitations(user_id, kind) WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX invitations_company_pending ON invitations(company_id, consumed_at, revoked_at, expires_at);
CREATE TABLE audit_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER REFERENCES companies(id),
 actor_id INTEGER REFERENCES users(id), subject_id INTEGER REFERENCES users(id),
 event_type TEXT NOT NULL, occurred_at TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_company_time ON audit_events(company_id, occurred_at DESC, id DESC);
CREATE TABLE attendance_requests (
 company_id INTEGER NOT NULL REFERENCES companies(id), user_id INTEGER NOT NULL REFERENCES users(id),
 request_key TEXT NOT NULL, request_hash TEXT NOT NULL, response_json TEXT NOT NULL,
 status_code INTEGER NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(company_id, user_id, request_key)
);
CREATE TABLE email_outbox (
 id INTEGER PRIMARY KEY AUTOINCREMENT, event_key TEXT NOT NULL UNIQUE,
 company_id INTEGER REFERENCES companies(id), invitation_id INTEGER REFERENCES invitations(id),
 kind TEXT NOT NULL, payload_encrypted TEXT, status TEXT NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','sending','sent','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, next_attempt_at TEXT NOT NULL,
 locked_until TEXT, sent_at TEXT, last_error TEXT
);
CREATE INDEX email_outbox_ready ON email_outbox(status, next_attempt_at, locked_until);
CREATE INDEX email_outbox_company ON email_outbox(company_id, status);
CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
