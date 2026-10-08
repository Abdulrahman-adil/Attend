const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { createApp } = require('../../app');
const { loadConfig } = require('../../config');

// In-memory test double only: no database connection or user records are created.
async function fixture(role = 'employee') {
  const user = { id: 7, name: 'Fixture', email: 'fixture@example.invalid',
    normalized_email: 'fixture@example.invalid', password: await bcrypt.hash('test-password', 4),
    role, company_id: 2, is_active: true, archived_at: null, google_id: 'fixture-subject' };
  const sessions = new Map();
  const tx = {
    async get(sql, params) {
      if (sql.includes('pg_advisory')) return {};
      if (sql.includes('JOIN sessions')) return sessions.get(params[0]) ? user : undefined;
      if (sql.includes('FROM users')) return user;
      throw new Error('Unexpected SQL: ' + sql);
    },
    async run(sql, params) {
      if (sql.startsWith('INSERT INTO sessions')) sessions.set(params[0], true);
      else if (sql.startsWith('UPDATE sessions')) sessions.delete(params[1]);
      else throw new Error('Unexpected SQL: ' + sql);
      return { rowCount: 1 };
    },
  };
  const config = loadConfig({ NODE_ENV: 'production', FRONTEND_URL: 'https://app.vaniillaa.com',
    DATABASE_URL: 'postgresql://unused.invalid/test', JWT_SECRET: 's'.repeat(32),
    OUTBOX_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'), GOOGLE_WEB_CLIENT_ID: 'test.apps.googleusercontent.com' });
  const app = createApp({ config, store: { read: fn => fn(tx), transaction: fn => fn(tx) },
    googleIdentity: { verify: async () => ({ subject: user.google_id, email: user.email, name: user.name }) } });
  return { app, config, user };
}

for (const role of ['employee', 'admin']) {
  test(`${role} password login returns bearer credentials and logout revokes the session`, async () => {
    const { app, config, user } = await fixture(role);
    const initial = await request(app).get('/api/auth/session').expect(401);
    assert.equal(initial.body.code, 'UNAUTHENTICATED');
    const login = await request(app).post('/api/auth/login').set('Origin', config.frontendUrl)
      .send({ email: user.email, password: 'test-password' }).expect(200);
    assert.ok(login.body.token); assert.ok(login.body.csrfToken);
    assert.equal(login.body.user.role, role);
    const auth = { Authorization: `Bearer ${login.body.token}` };
    await request(app).get('/api/auth/session').set(auth).expect(200);
    await request(app).post('/api/auth/logout').set(auth).set('Origin', config.frontendUrl).expect(200);
    await request(app).get('/api/auth/session').set(auth).expect(401);
  });
}

test('Google web login, cookie restoration without spaces, CSRF and logout', async () => {
  const { app, config } = await fixture();
  const login = await request(app).post('/api/auth/google').set('Origin', config.frontendUrl)
    .send({ credential: 'x'.repeat(100), platform: 'web' }).expect(200);
  const cookie = login.headers['set-cookie'][0];
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=None', 'Path=/']) assert.ok(cookie.includes(attribute));
  assert.ok(!cookie.includes('Domain='));
  const headers = { Cookie: `other=value;${cookie.split(';')[0]}` };
  const restored = await request(app).get('/api/auth/session').set(headers).expect(200);
  assert.equal(restored.body.token, login.body.token);
  assert.equal(restored.body.csrfToken, login.body.csrfToken);
  await request(app).post('/api/auth/logout').set(headers).set('Origin', config.frontendUrl).expect(403);
  await request(app).post('/api/auth/logout').set(headers).set('Origin', config.frontendUrl)
    .set('X-CSRF-Token', restored.body.csrfToken).expect(200);
  await request(app).get('/api/auth/session').set(headers).expect(401);
});
