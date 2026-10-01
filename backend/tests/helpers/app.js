const crypto = require('node:crypto');
const { openDatabase } = require('../../db/database');
const { loadConfig } = require('../../config');
const { createApp } = require('../../app');
const { createAuth } = require('../../middleware/authMiddleware');

function testConfig(overrides = {}) {
  return loadConfig({
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    OUTBOX_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
    EMAIL_ENABLED: 'false',
    ...overrides,
  });
}

async function testApp(t, overrides = {}) {
  const config = testConfig(overrides);
  const store = await openDatabase(':memory:', { applyMigrations: true });
  t.after(() => store.close());
  let instant = new Date('2026-09-10T08:00:00.000Z');
  const now = () => new Date(instant);
  const app = createApp({ store, config, now });
  const auth = createAuth({ store, config, now });
  const sessionFor = async userId => {
    const session = await store.transaction(async tx => {
      const user = await tx.get('SELECT * FROM users WHERE id=?', [userId]);
      return auth.loginSession(tx, user, now());
    });
    return {
      Cookie: `${config.production ? '__Host-attend_session' : 'attend_session'}=${session.token}`,
      'X-CSRF-Token': session.csrfToken,
    };
  };
  return { app, store, config, sessionFor, advance: ms => { instant = new Date(instant.getTime() + ms); } };
}

async function seedOrganization(store, name) {
  return store.transaction(async tx => {
    const address = `${name.toLowerCase()}@example.invalid`;
    const owner = await tx.run('INSERT INTO users(name,email,normalized_email,is_active) VALUES(?,?,?,1)', [name, address, address]);
    const company = await tx.run('INSERT INTO companies(name,owner_id,timezone,timezone_configured) VALUES(?,?,?,1)', [name, owner.lastID, 'Asia/Dubai']);
    await tx.run("UPDATE users SET role='manager',company_id=? WHERE id=?", [company.lastID, owner.lastID]);
    const employeeEmail = `employee-${address}`;
    const employee = await tx.run("INSERT INTO users(name,email,normalized_email,role,company_id,is_active) VALUES(?,?,?,'employee',?,1)", ['Example employee', employeeEmail, employeeEmail, company.lastID]);
    return { ownerId: owner.lastID, companyId: company.lastID, employeeId: employee.lastID };
  });
}

module.exports = { testConfig, testApp, seedOrganization };
