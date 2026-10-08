const { pgTest: test, isolatedStore, testConfig } = require('./helpers/app');
const assert = require('node:assert/strict');
const request = require('supertest');
const { startServer } = require('../server');
const { checkSchema, migrate } = require('../db/postgresMigrations');

test('server validates PostgreSQL schema, serves health, rejects occupied port and closes', async t => {
  const { store, schema } = await isolatedStore(t);
  await checkSchema(store);
  await migrate(store); // A second run is a no-op, not a schema reset.
  const config = { ...testConfig({ PORT: '0' }), testSchema: schema };
  const runtime = await startServer({ config, logger: { info() {}, error() {} } });
  try {
    await request(runtime.server).get('/api/health').expect(200, { status: 'ok' });
    await request(runtime.server).get('/api/auth/session').expect(401);
    await assert.rejects(startServer({ config: { ...config, port: runtime.server.address().port }, logger: { info() {}, error() {} } }), { code: 'EADDRINUSE' });
  } finally { await runtime.close(); await runtime.close(); }
  assert.equal(runtime.server.listening, false);
});
test('transaction rollback removes partial writes and schema drift fails readiness', async t => {
  const { store } = await isolatedStore(t);
  await assert.rejects(store.transaction(async tx => {
    await tx.run("INSERT INTO users(name,email,normalized_email) VALUES('Rollback','rollback@example.invalid','rollback@example.invalid')");
    throw new Error('rollback sentinel');
  }), /rollback sentinel/);
  assert.equal((await store.read(tx => tx.get('SELECT COUNT(*) AS n FROM users'))).n, 0);
  await store.read(tx => tx.exec('ALTER TABLE users DROP COLUMN password'));
  await assert.rejects(checkSchema(store), /baseline differs/);
});
