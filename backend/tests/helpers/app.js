const crypto = require('node:crypto');
const test = require('node:test');
const { Pool } = require('pg');
const { createPostgresStore } = require('../../db/postgres');
const { migrate } = require('../../db/postgresMigrations');
const { loadConfig } = require('../../config');
const { createApp } = require('../../app');
const { createAuth } = require('../../middleware/authMiddleware');
const pgTest = (name, fn) => test(name, { skip: !process.env.TEST_DATABASE_URL ? 'EXTERNAL VERIFICATION REQUIRED: TEST_DATABASE_URL is not configured.' : false }, fn);
function testConfig(overrides = {}) {
  return loadConfig({
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    OUTBOX_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
    DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://127.0.0.1/attend_test',
    GOOGLE_WEB_CLIENT_ID: 'test.apps.googleusercontent.com',
    EMAIL_ENABLED: 'false',
    HOST: '127.0.0.1',
    ...overrides,
  });
}
async function isolatedStore(t) {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString || !/^attend_test(?:_|$)/.test(new URL(connectionString).pathname.slice(1)))
    throw new Error('Integration tests require a dedicated database named attend_test or attend_test_*. Never use a production URL.');
  const schema = 'attend_test_' + crypto.randomBytes(12).toString('hex');
  const admin = new Pool({ connectionString });
  try { await admin.query('CREATE SCHEMA ' + schema); }
  catch (error) { await admin.end(); throw error; }
  const store = createPostgresStore({ databaseUrl: connectionString, schema });
  t.after(async () => {
    await store.close();
    try { await admin.query('DROP SCHEMA ' + schema + ' CASCADE'); } finally { await admin.end(); }
  });
  await migrate(store);
  return { store, schema };
}
async function testApp(t, overrides = {}, googleIdentity) {
  const config = testConfig(overrides);
  const { store, schema } = await isolatedStore(t);
  config.testSchema = schema;
  let instant = new Date('2026-09-10T08:00:00.000Z');
  const now = () => new Date(instant);
  const app = createApp({ store, config, now, ...(googleIdentity ? { googleIdentity } : {}) });
  const auth = createAuth({ store, config, now });
  const sessionFor = async userId => {
    const session = await store.transaction(async tx => auth.loginSession(tx, await tx.get('SELECT * FROM users WHERE id=$1', [userId]), now()));
    return { Cookie: (config.production ? '__Host-attend_session' : 'attend_session') + '=' + session.token, 'X-CSRF-Token': session.csrfToken };
  };
  return { app, store, config, sessionFor, advance: ms => { instant = new Date(instant.getTime() + ms); } };
}
// Fixtures are only inserted into the unique schema in the explicitly designated test DB.
async function seedOrganization(store, name) {
  return store.transaction(async tx => {
    const address = name.toLowerCase() + '@example.invalid';
    const owner = await tx.run('INSERT INTO users(name,email,normalized_email,is_active) VALUES($1,$2,$3,TRUE) RETURNING id', [name, address, address]);
    const company = await tx.run('INSERT INTO companies(name,owner_id,timezone,timezone_configured) VALUES($1,$2,$3,TRUE) RETURNING id', [name, owner.id, 'Asia/Dubai']);
    await tx.run("UPDATE users SET role='manager',company_id=$1 WHERE id=$2", [company.id, owner.id]);
    const employeeEmail = 'employee-' + address;
    const employee = await tx.run("INSERT INTO users(name,email,normalized_email,role,company_id,is_active) VALUES($1,$2,$3,'employee',$4,TRUE) RETURNING id", ['Example employee', employeeEmail, employeeEmail, company.id]);
    return { ownerId: owner.id, companyId: company.id, employeeId: employee.id };
  });
}
module.exports = { pgTest, testConfig, isolatedStore, testApp, seedOrganization };
