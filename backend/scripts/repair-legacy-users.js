const path = require('node:path');
const sqlite3 = require('sqlite3');
const { migrate, CURRENT_VERSION } = require('../db/migrations');
const { audit } = require('../services/auditService');

// This is an explicit, offline recovery operation, never part of server startup.
async function connection(filename, readOnly) {
  const db = await new Promise((resolve, reject) => {
    const opened = new sqlite3.Database(filename, readOnly ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE, error => error ? reject(error) : resolve(opened));
  });
  db.configure('busyTimeout', 5000);
  return {
    get: (sql, args = []) => new Promise((resolve, reject) => db.get(sql, args, (error, row) => error ? reject(error) : resolve(row))),
    all: (sql, args = []) => new Promise((resolve, reject) => db.all(sql, args, (error, rows) => error ? reject(error) : resolve(rows))),
    run: (sql, args = []) => new Promise((resolve, reject) => db.run(sql, args, error => error ? reject(error) : resolve())),
    exec: sql => new Promise((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve())),
    close: () => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve())),
  };
}

async function recoveryPlan(tx, identitySource) {
  if (await tx.get("SELECT name FROM sqlite_master WHERE name='schema_migrations'")) {
    throw new Error('This repair is only for an unmigrated legacy database.');
  }
  const references = await tx.all(`
    SELECT a.employee_id AS user_id, 'employee' AS role, l.company_id
    FROM attendance a LEFT JOIN users u ON u.id=a.employee_id LEFT JOIN locations l ON l.id=a.location_id
    WHERE u.id IS NULL
    UNION ALL
    SELECT c.owner_id AS user_id, 'manager' AS role, c.id AS company_id
    FROM companies c LEFT JOIN users u ON u.id=c.owner_id WHERE u.id IS NULL
  `);
  const users = new Map();
  for (const row of references) {
    if (!Number.isSafeInteger(row.user_id) || row.user_id < 1 || !row.company_id || !await tx.get('SELECT id FROM companies WHERE id=?', [row.company_id])) {
      throw new Error('Cannot recover a missing user without an unambiguous existing company.');
    }
    const previous = users.get(row.user_id);
    if (previous && (previous.companyId !== row.company_id || previous.role !== row.role)) {
      throw new Error(`Conflicting company or role references for missing user ${row.user_id}.`);
    }
    if (previous) continue;
    // Names may be recovered only when both the historical role and tenant agree.
    const identity = identitySource && await identitySource.get('SELECT name,role,company_id FROM users WHERE id=?', [row.user_id]);
    const recoveredName = Boolean(identity && identity.role === row.role && identity.company_id === row.company_id && typeof identity.name === 'string' && identity.name.trim());
    const email = `legacy-user-${row.user_id}@archive.invalid`;
    if (await tx.get('SELECT id FROM users WHERE LOWER(TRIM(email))=?', [email])) {
      throw new Error(`Recovery email already exists for user ${row.user_id}.`);
    }
    users.set(row.user_id, {
      id: row.user_id, role: row.role, companyId: row.company_id,
      name: recoveredName ? identity.name : `Unknown archived ${row.role} #${row.user_id}`,
      email, recoveredName,
    });
  }
  return [...users.values()].sort((a, b) => a.id - b.id);
}

async function repairLegacyUsers(filename, { identitySourcePath, apply = false, now = () => new Date() } = {}) {
  const tx = await connection(filename, !apply);
  let identities;
  let inTransaction = false;
  try {
    if (identitySourcePath) identities = await connection(identitySourcePath, true);
    await tx.exec('PRAGMA foreign_keys=ON');
    await tx.exec(apply ? 'BEGIN IMMEDIATE' : 'BEGIN');
    inTransaction = true;
    const plan = await recoveryPlan(tx, identities);
    const summary = plan.map(({ id, role, companyId, recoveredName }) => ({ id, role, companyId, recoveredName }));
    if (!apply) {
      await tx.exec('ROLLBACK');
      inTransaction = false;
      return { operation: 'read-only recovery plan', users: summary };
    }
    const time = now().toISOString();
    for (const user of plan) {
      // Preserve the old IDs without restoring login credentials or real email addresses.
      await tx.run('INSERT INTO users(id,name,email,role,company_id,is_active) VALUES(?,?,?,?,?,0)', [user.id, user.name, user.email, user.role, user.companyId]);
    }
    await migrate(tx);
    for (const user of plan) {
      await tx.run('UPDATE users SET archived_at=? WHERE id=?', [time, user.id]);
      await audit(tx, {
        companyId: user.companyId, subjectId: user.id, type: 'legacy.user_archived_recovery',
        details: { recoveredName: user.recoveredName, identitySource: user.recoveredName ? path.basename(identitySourcePath) : null, credentialsRestored: false },
      }, time);
    }
    const integrity = await tx.get('PRAGMA integrity_check');
    if (Object.values(integrity)[0] !== 'ok' || (await tx.all('PRAGMA foreign_key_check')).length) {
      throw new Error('Recovery failed database integrity checks.');
    }
    await tx.exec('COMMIT');
    inTransaction = false;
    return { operation: 'legacy recovery and migration applied', version: CURRENT_VERSION, users: summary };
  } catch (error) {
    if (inTransaction) await tx.exec('ROLLBACK');
    throw error;
  } finally {
    if (identities) await identities.close();
    await tx.close();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const value = flag => args.indexOf(flag) < 0 ? undefined : args[args.indexOf(flag) + 1];
  const filename = value('--database');
  if (!filename || filename.startsWith('--')) {
    console.error('Usage: node scripts/repair-legacy-users.js --database PATH [--identity-source PATH] [--apply]. Back up and stop the application before applying; rehearse on a copy first.');
    process.exitCode = 1;
  } else {
    repairLegacyUsers(path.resolve(filename), { identitySourcePath: value('--identity-source'), apply: args.includes('--apply') })
      .then(result => console.log(JSON.stringify(result)))
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}

module.exports = { repairLegacyUsers };
