const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const request = require('supertest');
const { convertPlaceholders } = require('../../db/sql');
const { safeInteger } = require('../../db/postgres');
const { loadConfig } = require('../../config');
const { createAuth } = require('../../middleware/authMiddleware');
const { createApp } = require('../../app');
const { createAuthController } = require('../../controllers/authController');
const { bootstrapAdmin } = require('../../services/bootstrapAdmin');
const { queueEmail, decrypt, createOutboxWorker } = require('../../services/emailService');
const { createGoogleIdentity } = require('../../services/googleIdentity');
const { OAuth2Client } = require('google-auth-library');
function config(production = false) {
  return loadConfig({
    NODE_ENV: production ? 'production' : 'test',
    FRONTEND_URL: production ? 'https://app.vaniillaa.com' : 'http://localhost:5174',
    DATABASE_URL: 'postgresql://localhost/attend_test',
    GOOGLE_WEB_CLIENT_ID: 'test.apps.googleusercontent.com',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    OUTBOX_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
  });
}
test('SQL parameters preserve strings, identifiers, comments, dollar quoting, and native parameters', () => {
  assert.equal(convertPlaceholders("SELECT ?, '?', \"?\", $$?$$, $fn$?$fn$ -- ?\n/* ? /* ? */ */ WHERE id=?"),
    "SELECT $1, '?', \"?\", $$?$$, $fn$?$fn$ -- ?\n/* ? /* ? */ */ WHERE id=$2");
  assert.equal(convertPlaceholders("SELECT data ?? $1"), 'SELECT data ? $1');
  assert.throws(() => convertPlaceholders('SELECT $1, ?'), /mix/);
  assert.throws(() => convertPlaceholders('SELECT /*'), /Unterminated/);
});
test('BIGINT contract refuses precision loss', () => {
  assert.equal(safeInteger('9007199254740991'), Number.MAX_SAFE_INTEGER);
  assert.throws(() => safeInteger('9007199254740992'), RangeError);
});
test('store commits, rolls back, releases clients and discards broken rollback connections', async () => {
  const calls = [], releases = [];
  let rollbackFailure = false;
  const client = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql === 'ROLLBACK' && rollbackFailure) throw new Error('lost connection');
    return { rows: [{ id: 7 }], rowCount: 1 };
  }, release: error => releases.push(Boolean(error)) };
  class Pool {
    on(name, handler) { assert.equal(name, 'error'); assert.equal(typeof handler, 'function'); }
    connect() { return client; }
    query(...args) { return client.query(...args); }
    end() {}
  }
  const sandbox = { module: { exports: {} }, require: name => name === 'pg' ? { Pool, types: {} } : { convertPlaceholders }, process, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../db/postgres.js'), 'utf8'), sandbox);
  const store = sandbox.module.exports.createPostgresStore();
  const value = await store.transaction(tx => tx.run('INSERT INTO x VALUES(?) RETURNING id', [7]));
  assert.equal(value.id, 7); assert.equal(value.rowCount, 1);
  assert.equal(calls.at(-1).sql, 'COMMIT');
  await assert.rejects(store.transaction(async () => { throw new Error('original'); }), /original/);
  rollbackFailure = true;
  await assert.rejects(store.transaction(async () => { throw new Error('original'); }), /original/);
  assert.deepEqual(releases, [false, false, true]);
});
test('production config rejects missing database and missing Google client', () => {
  const env = { NODE_ENV: 'production', FRONTEND_URL: 'https://app.vaniillaa.com', JWT_SECRET: 'x'.repeat(32), OUTBOX_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64') };
  assert.throws(() => loadConfig(env), /DATABASE_URL/);
  assert.throws(() => loadConfig({ ...env, DATABASE_URL: 'postgresql://localhost/attend_test' }), /GOOGLE_WEB_CLIENT_ID/);
});
test('session cookies retain host prefix and security attributes; JWT is backed by hashed token', async () => {
  const cfg = config(true), now = () => new Date();
  const auth = createAuth({ config: cfg, store: {}, now });
  let stored;
  const session = await auth.loginSession({ run: async (sql, params) => { stored = params; } }, { id: 12 }, now());
  assert.equal(stored[0], crypto.createHash('sha256').update(session.token).digest('hex'));
  auth.setCookie({ cookie(name, value, flags) {
    assert.equal(name, '__Host-attend_session'); assert.equal(value, session.token);
    assert.equal(flags.secure, true); assert.equal(flags.httpOnly, true);
    assert.equal(flags.sameSite, 'none'); assert.equal(flags.path, '/'); assert.equal(flags.domain, undefined);
  } }, session.token);
});
test('Google verification passes configured audience and rejects unverified email / invalid credentials', async t => {
  let payload = { sub: '123', email: 'person@example.invalid', name: 'Person', email_verified: true };
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async ({ audience }) => {
    assert.deepEqual(audience, ['test.apps.googleusercontent.com']); return { getPayload: () => payload };
  });
  const identity = createGoogleIdentity(config());
  assert.equal((await identity.verify('credential')).subject, '123');
  payload.email_verified = false;
  await assert.rejects(identity.verify('credential'), { code: 'GOOGLE_IDENTITY_INVALID' });
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => { throw new Error('invalid signature'); });
  await assert.rejects(identity.verify('credential'), { code: 'GOOGLE_IDENTITY_INVALID' });
});
test('expired PostgreSQL Date invitation is rejected before activation', async () => {
  const controller = createAuthController({
    store: { read: fn => fn({ get: async () => ({ expires_at: new Date('2000-01-01'), company_id: null, user_company_id: null }) }) },
    now: () => new Date(), config: config(), auth: {},
  });
  await assert.rejects(controller.inspectInvitation({ body: { token: 'a'.repeat(64) } }, { json() { assert.fail('expired invitation accepted'); } }), { code: 'INVITATION_UNAVAILABLE' });
});
test('first admin command refuses missing or existing accounts and never inserts users', async () => {
  let existingAdmin = false, user;
  const sqls = [];
  const store = { transaction: fn => fn({
    get: async sql => { sqls.push(sql); return sql.includes("role='admin'") ? (existingAdmin ? { id: 1 } : undefined) : sql.includes('google_id=') ? user : undefined; },
    run: async sql => { sqls.push(sql); },
  }) };
  await assert.rejects(bootstrapAdmin(store, '123'), /must sign in/);
  user = { id: 3, company_id: null };
  await bootstrapAdmin(store, '123');
  existingAdmin = true;
  await assert.rejects(bootstrapAdmin(store, '123'), /already exists/);
  assert.ok(!sqls.some(sql => /INSERT INTO users/.test(sql)));
});
test('outbox authenticated encryption rejects tampering', async () => {
  const cfg = config(); let encrypted;
  await queueEmail({ run: async (_sql, params) => { encrypted = params[4]; } }, cfg, { eventKey: 'unit', kind: 'invitation', payload: { token: 'example' } }, new Date().toISOString());
  assert.deepEqual(decrypt(encrypted, cfg.outboxKey), { token: 'example' });
  const changed = Buffer.from(encrypted, 'base64'); changed[changed.length - 1] ^= 1;
  assert.throws(() => decrypt(changed.toString('base64'), cfg.outboxKey));
});
test('worker skips expired invitations and stop prevents future drains', async () => {
  const statements = [];
  const store = { transaction: fn => fn({
    get: async sql => sql.includes('email_outbox') ? { id: 1, invitation_id: 2 } : { expires_at: new Date('2000-01-01') },
    run: async sql => { statements.push(sql); },
  }) };
  const worker = createOutboxWorker({ store, config: config(), mailer: { send() { assert.fail('expired email sent'); } } });
  await worker.drain(1); assert.ok(statements[0].includes("status='cancelled'"));
  await worker.stop(); await worker.drain(1); assert.equal(statements.length, 1);
});
test('auth HTTP rejects disallowed origins, missing CSRF and invalid sessions without leaking errors', async () => {
  const cfg = config(true);
  const store = { read: fn => fn({ get: async () => undefined }) };
  const app = createApp({ store, config: cfg });
  await request(app).post('/api/auth/google').set('Origin', 'https://other.invalid').send({ credential: 'x'.repeat(100) }).expect(403);
  await request(app).get('/api/auth/session').set('Cookie', '__Host-attend_session=invalid').expect(401);
  const preflight = await request(app).options('/api/auth/google').set('Origin', cfg.frontendUrl).set('Access-Control-Request-Method', 'POST').expect(204);
  assert.equal(preflight.headers['access-control-allow-origin'], cfg.frontendUrl);
  assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
});
