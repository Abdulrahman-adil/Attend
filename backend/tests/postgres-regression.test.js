const { pgTest: test, testApp, seedOrganization } = require('./helpers/app');
const assert = require('node:assert/strict');
const request = require('supertest');
const { bootstrapAdmin } = require('../services/bootstrapAdmin');
const { createOutboxWorker, queueEmail } = require('../services/emailService');

test('Google login creates no automatic admin, preserves session, bootstraps once and logs out', async t => {
  const identity = { verify: async () => ({ subject: '123456789', email: 'google@example.invalid', name: 'Google fixture' }) };
  const { app, store } = await testApp(t, {}, identity);
  const agent = request.agent(app);
  const signed = await agent.post('/api/auth/google').send({ credential: 'x'.repeat(100) }).expect(200);
  assert.equal(signed.body.user.role, 'employee');
  assert.equal(typeof signed.body.user.id, 'number');
  await agent.get('/api/auth/session').expect(200);
  await bootstrapAdmin(store, '123456789');
  await assert.rejects(bootstrapAdmin(store, '123456789'), /already exists/);
  const session = await agent.get('/api/auth/session').expect(200);
  assert.equal(session.body.user.role, 'admin');
  await agent.post('/api/auth/logout').set('X-CSRF-Token', session.body.csrfToken).expect(200);
  await agent.get('/api/auth/session').expect(401);
});

test('concurrent Google login for one subject creates one identity and two sessions', async t => {
  const identity = { verify: async () => ({ subject: '123456789', email: 'race@example.invalid', name: 'Race fixture' }) };
  const { app, store } = await testApp(t, {}, identity);
  const login = () => request(app).post('/api/auth/google').send({ credential: 'x'.repeat(100) });
  const results = await Promise.all([login(), login()]);
  assert.deepEqual(results.map(r => r.status), [200, 200]);
  assert.equal((await store.read(tx => tx.get('SELECT COUNT(*) AS n FROM users'))).n, 1);
  assert.equal((await store.read(tx => tx.get("SELECT COUNT(*) AS n FROM users WHERE role='admin'"))).n, 0);
});

test('concurrent organization onboarding creates exactly one company', async t => {
  const identity = { verify: async () => ({ subject: '123456789', email: 'owner@example.invalid', name: 'Owner fixture' }) };
  const { app, store } = await testApp(t, {}, identity);
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/google').send({ credential: 'x'.repeat(100) }).expect(200);
  const create = () => agent.post('/api/users/role').set('X-CSRF-Token', login.body.csrfToken).send({ role: 'manager', companyName: 'Test company', timezone: 'Asia/Dubai' });
  const results = await Promise.all([create(), create()]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await store.read(tx => tx.get('SELECT COUNT(*) AS n FROM companies'))).n, 1);
});

test('concurrent attendance retries return identical JSONB response once committed', async t => {
  const { app, store, sessionFor } = await testApp(t);
  const company = await seedOrganization(store, 'Concurrent');
  const manager = await sessionFor(company.ownerId), employee = await sessionFor(company.employeeId);
  const location = await request(app).post('/api/locations').set(manager).send({ name: 'Test office', latitude: 25, longitude: 55, radius: 100 }).expect(201);
  const send = () => request(app).post('/api/attendance/check-in').set(employee).set('Idempotency-Key', 'same_request_123456')
    .send({ locationId: location.body.id, latitude: 25, longitude: 55, accuracy: 5 });
  const results = await Promise.all([send(), send()]);
  assert.deepEqual(results.map(r => r.status), [201, 201]);
  assert.deepEqual(results[0].body, results[1].body);
  assert.equal((await store.read(tx => tx.get('SELECT COUNT(*) AS n FROM attendance'))).n, 1);
  assert.equal((await store.read(tx => tx.get('SELECT COUNT(*) AS n FROM attendance_requests'))).n, 1);
});

test('database rejects cross-tenant attendance and transaction rollback leaves no row', async t => {
  const { store } = await testApp(t);
  const one = await seedOrganization(store, 'One'), two = await seedOrganization(store, 'Two');
  await assert.rejects(store.transaction(tx => tx.run('INSERT INTO attendance(employee_id,company_id,check_in_time,check_in_latitude,check_in_longitude) VALUES($1,$2,NOW(),25,55)', [one.employeeId, two.companyId])), { code: '23503' });
  assert.equal((await store.read(tx => tx.get('SELECT COUNT(*) AS n FROM attendance'))).n, 0);
});

test('separate workers claim one outbox job once', async t => {
  const { store, config } = await testApp(t);
  await store.transaction(tx => queueEmail(tx, config, { eventKey: 'worker-concurrency', kind: 'attendance', payload: { to: 'fixture@example.invalid', name: 'Fixture', action: 'check-in', time: new Date().toISOString() } }, new Date().toISOString()));
  let deliveries = 0;
  const mailer = { send: async () => { deliveries++; await new Promise(r => setTimeout(r, 30)); return {}; } };
  const logger = { info() {}, error() {} };
  const first = createOutboxWorker({ store, config, mailer, logger }), second = createOutboxWorker({ store, config, mailer, logger });
  await Promise.all([first.drain(1), second.drain(1)]);
  await first.stop(); await second.stop();
  assert.equal(deliveries, 1);
  assert.equal((await store.read(tx => tx.get('SELECT status FROM email_outbox'))).status, 'sent');
});
