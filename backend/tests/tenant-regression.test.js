const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { testApp, seedOrganization } = require('./helpers/app');

test('manager archival is tenant scoped, preserves history, and revokes the employee session', async t => {
  const { app, store, sessionFor } = await testApp(t);
  const first = await seedOrganization(store, 'First');
  const second = await seedOrganization(store, 'Second');
  const manager = await sessionFor(first.ownerId);
  const employee = await sessionFor(first.employeeId);

  for (const base of ['/api/employees', '/api/users/users']) {
    await request(app).delete(`${base}/${second.employeeId}`).set(manager).expect(404);
    await request(app).delete(`${base}/${first.ownerId}`).set(manager).expect(404);
    await request(app).delete(`${base}/${first.employeeId}`).set(employee).expect(403);
    await request(app).delete(`${base}/${first.employeeId}`).expect(401);
    await request(app).delete(`${base}/${first.employeeId}`).set('Cookie', manager.Cookie).expect(403);
  }

  await store.transaction(tx => tx.run('INSERT INTO attendance(employee_id,company_id,check_in_time,check_out_time,check_in_latitude,check_in_longitude,check_out_latitude,check_out_longitude) VALUES(?,?,?,?,?,?,?,?)', [first.employeeId, first.companyId, '2026-09-09T08:00:00.000Z', '2026-09-09T16:00:00.000Z', 25, 55, 25, 55]));
  await request(app).delete(`/api/users/users/${first.employeeId}`).set(manager).expect(200);
  await request(app).get('/api/auth/session').set(employee).expect(401);
  const archived = await store.read(tx => tx.get('SELECT * FROM users WHERE id=?', [first.employeeId]));
  assert.ok(archived.archived_at);
  assert.equal(archived.is_active, 0);
  const history = await request(app).get(`/api/attendance/${first.employeeId}`).set(manager).expect(200);
  assert.equal(history.body.total, 1);
  const foreign = await store.read(tx => tx.get('SELECT * FROM users WHERE id=?', [second.employeeId]));
  assert.equal(foreign.archived_at, null);
});

test('an employee with open attendance cannot be archived', async t => {
  const { app, store, sessionFor } = await testApp(t);
  const company = await seedOrganization(store, 'Open');
  const manager = await sessionFor(company.ownerId);
  await store.transaction(tx => tx.run('INSERT INTO attendance(employee_id,company_id,check_in_time,check_in_latitude,check_in_longitude) VALUES(?,?,?,?,?)', [company.employeeId, company.companyId, '2026-09-10T07:00:00.000Z', 25, 55]));
  const result = await request(app).delete(`/api/employees/${company.employeeId}`).set(manager).expect(409);
  assert.equal(result.body.code, 'OPEN_ATTENDANCE');
  const employee = await store.read(tx => tx.get('SELECT * FROM users WHERE id=?', [company.employeeId]));
  assert.equal(employee.archived_at, null);
  assert.equal(employee.is_active, 1);
});
