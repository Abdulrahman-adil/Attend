const { pgTest: test } = require('./helpers/app');
const assert = require('node:assert/strict');
const request = require('supertest');
const { testApp, seedOrganization } = require('./helpers/app');
const { decrypt } = require('../services/emailService');

test('health, CORS, missing routes and unavailable Google return controlled responses', async t => {
  const { app, config } = await testApp(t);
  await request(app).get('/api/health').expect(200, { status: 'ok' });
  const preflight = await request(app).options('/api/auth/login')
    .set('Origin', config.frontendUrl).set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'Content-Type,X-CSRF-Token,Idempotency-Key').expect(204);
  assert.equal(preflight.headers['access-control-allow-origin'], config.frontendUrl);
  assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
  const missing = await request(app).get('/api/unknown').expect(404);
  assert.equal(missing.body.code, 'NOT_FOUND');
  for (const path of ['/api/auth/google', '/api/auth/google/callback']) {
    const unavailable = await request(app).get(path).expect(503);
    assert.equal(unavailable.body.code, 'GOOGLE_AUTH_UNAVAILABLE');
  }
});

test('async validation, authentication and invalid JSON keep their HTTP status', async t => {
  const { app } = await testApp(t, { NODE_ENV: 'production', FRONTEND_URL: 'https://attendance.example.invalid' });
  const validation = await request(app).post('/api/auth/login').send({}).expect(400);
  assert.equal(validation.body.code, 'VALIDATION');
  assert.equal(validation.body.stack, undefined);
  const unauthorized = await request(app).get('/api/employees').expect(401);
  assert.equal(unauthorized.body.code, 'UNAUTHENTICATED');
  await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{').expect(400);
});

test('unexpected database failures return a generic production error without crashing HTTP', async t => {
  const { app, store, sessionFor } = await testApp(t, { NODE_ENV: 'production', FRONTEND_URL: 'https://attendance.example.invalid' });
  const company = await seedOrganization(store, 'Failure');
  const manager = await sessionFor(company.ownerId);
  await store.read(tx => tx.exec('DROP TABLE sessions'));
  const failed = await request(app).get('/api/auth/session').set(manager).expect(500);
  assert.deepEqual(failed.body, { message: 'Internal Server Error', code: 'INTERNAL_ERROR' });
  await request(app).get('/api/health').expect(500);
});

test('registered accounts can activate, sign in, create an organization and invite an employee over HTTP', async t => {
  const { app, store, config, advance } = await testApp(t);
  const manager = request.agent(app);
  const password = 'SyntheticPassword123!';
  await manager.post('/api/auth/register').send({ name: 'Manager', email: 'manager@example.invalid', password }).expect(201);
  const activationMail = await store.read(tx => tx.get("SELECT * FROM email_outbox WHERE kind='activation'"));
  const token = decrypt(activationMail.payload_encrypted, config.outboxKey).token;
  const inspected = await manager.post('/api/auth/invitation/inspect').send({ token }).expect(200);
  assert.equal(inspected.body.requiresPassword, false);
  await manager.post('/api/auth/activate').send({ token }).expect(200);
  const login = await manager.post('/api/auth/login').send({ email: 'manager@example.invalid', password }).expect(200);
  const csrf = login.body.csrfToken;
  assert.ok(login.headers['set-cookie'].some(cookie => cookie.includes('HttpOnly')));
  const session = await manager.get('/api/auth/session').expect(200);
  assert.equal(session.body.csrfToken, csrf);
  await manager.get('/api/employees').expect(403);
  await manager.post('/api/users/role').send({ role: 'manager', companyName: 'Example Company', timezone: 'Asia/Dubai' }).expect(403);
  await manager.post('/api/users/role').set('X-CSRF-Token', csrf)
    .send({ role: 'manager', companyName: 'Example Company', timezone: 'Asia/Dubai' }).expect(200);
  const invited = await manager.post('/api/employees').set('X-CSRF-Token', csrf)
    .send({ name: 'Employee', email: 'employee@example.invalid' }).expect(201);
  const employeeId = invited.body.employee.id;
  advance(61000);
  await manager.post(`/api/employees/${employeeId}/resend`).set('X-CSRF-Token', csrf).expect(200);
  const roster = await manager.get('/api/employees').expect(200);
  assert.equal(roster.body.total, 1);
  assert.equal(roster.body.items[0].id, employeeId);
  const mail = await store.read(tx => tx.get("SELECT * FROM email_outbox WHERE kind='invitation' AND status='pending' ORDER BY id DESC LIMIT 1"));
  const employeeToken = decrypt(mail.payload_encrypted, config.outboxKey).token;
  await request(app).post('/api/auth/activate').send({ token: employeeToken, password }).expect(200);
  await request(app).post('/api/auth/request-link').send({ email: 'employee@example.invalid', kind: 'password_reset' }).expect(200);
  await manager.delete(`/api/employees/${employeeId}`).set('X-CSRF-Token', csrf).expect(200);
  await manager.post('/api/auth/logout').set('X-CSRF-Token', csrf).expect(200);
  await manager.get('/api/auth/session').expect(401);
});

test('location and attendance routes enforce roles, tenancy and explicit idempotent commands', async t => {
  const { app, store, sessionFor, advance } = await testApp(t);
  const company = await seedOrganization(store, 'Attendance');
  const foreign = await seedOrganization(store, 'Foreign');
  const manager = await sessionFor(company.ownerId);
  const employee = await sessionFor(company.employeeId);
  const foreignManager = await sessionFor(foreign.ownerId);
  const location = await request(app).post('/api/locations').set(manager)
    .send({ name: 'Office', latitude: 25, longitude: 55, radius: 100 }).expect(201);
  const locationId = location.body.id;
  const sites = await request(app).get('/api/locations').set(employee).expect(200);
  assert.equal(sites.body[0].id, locationId);
  await request(app).post('/api/locations').set(employee).send({}).expect(403);
  await request(app).delete(`/api/locations/${locationId}`).set(foreignManager).expect(404);
  await request(app).get('/api/attendance/dashboard').set(manager).expect(403);
  await request(app).get(`/api/attendance/${company.employeeId}`).set(foreignManager).expect(404);
  const sample = { latitude: 25, longitude: 55, locationId, accuracy: 5 };
  const legacy = await request(app).post('/api/attendance/clock').set(employee).send(sample).expect(409);
  assert.equal(legacy.body.code, 'CLIENT_UPGRADE_REQUIRED');
  await request(app).post('/api/attendance/check-in').set(employee).send(sample).expect(400);
  const checkIn = () => request(app).post('/api/attendance/check-in').set(employee)
    .set('Idempotency-Key', 'test_check_in_123456').send(sample);
  const first = await checkIn().expect(201);
  const replay = await checkIn().expect(201);
  assert.equal(replay.headers['idempotency-replayed'], 'true');
  assert.equal(replay.body.attendance.id, first.body.attendance.id);
  const dashboard = await request(app).get('/api/attendance/dashboard').set(employee).expect(200);
  assert.equal(dashboard.body.latestAttendance.id, first.body.attendance.id);
  await request(app).delete(`/api/locations/${locationId}`).set(manager).expect(200);
  advance(3600000);
  await request(app).post('/api/attendance/check-out').set(employee).set('Idempotency-Key', 'test_check_out_123456')
    .send({ ...sample, attendanceId: first.body.attendance.id }).expect(200);
  const history = await request(app).get(`/api/attendance/${company.employeeId}`).set(manager).expect(200);
  assert.equal(history.body.total, 1);
  assert.equal(history.body.items[0].checkOutTime, '2026-09-10T09:00:00.000Z');
});
