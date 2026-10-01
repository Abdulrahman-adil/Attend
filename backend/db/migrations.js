const fs = require('node:fs');
const path = require('node:path');
const { hash } = require('../lib/http');
const CURRENT_VERSION = 4;
async function inspectLegacy(tx) {
  if (!await tx.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")) return [];
  const problems = [];
  const checks = [
    ['duplicate normalized email', 'SELECT COUNT(*) AS n FROM (SELECT LOWER(TRIM(email)) FROM users GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1)'],
    ['multiple open attendance records', 'SELECT COUNT(*) AS n FROM (SELECT employee_id FROM attendance WHERE check_out_time IS NULL GROUP BY employee_id HAVING COUNT(*) > 1)'],
    ['attendance without tenant', 'SELECT COUNT(*) AS n FROM attendance a JOIN users u ON u.id=a.employee_id WHERE u.company_id IS NULL'],
    ['attendance location belongs to another tenant', 'SELECT COUNT(*) AS n FROM attendance a JOIN users u ON u.id=a.employee_id JOIN locations l ON l.id=a.location_id WHERE u.company_id != l.company_id'],
    ['invalid worksite geometry', 'SELECT COUNT(*) AS n FROM locations WHERE latitude NOT BETWEEN -90 AND 90 OR longitude NOT BETWEEN -180 AND 180 OR radius <= 0 OR radius > 100000'],
    ['invalid attendance timestamps', "SELECT COUNT(*) AS n FROM attendance WHERE julianday(check_in_time) IS NULL OR (check_out_time IS NOT NULL AND (julianday(check_out_time) IS NULL OR julianday(check_out_time)<julianday(check_in_time)))"],
    ['invalid user roles/status', "SELECT COUNT(*) AS n FROM users WHERE (role IS NOT NULL AND role NOT IN ('manager','employee')) OR is_active NOT IN (0,1) OR is_active IS NULL"],
    ['duplicate Google identities', "SELECT COUNT(*) AS n FROM (SELECT google_id FROM users WHERE google_id IS NOT NULL GROUP BY google_id HAVING COUNT(*) > 1)"],
  ];
  for (const [kind, sql] of checks) { const row = await tx.get(sql); if (row.n) problems.push({ kind, count: row.n }); }
  const orphans = await tx.all('PRAGMA foreign_key_check');
  if (orphans.length) problems.push({ kind: 'foreign key violations', count: orphans.length });
  return problems;
}
async function migrate(tx) {
  const problems = await inspectLegacy(tx);
  if (problems.length) throw new Error(`Migration stopped; existing data needs an explicit repair plan: ${JSON.stringify(problems)}. No records changed.`);
  await tx.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const row = await tx.get('SELECT MAX(version) AS version FROM schema_migrations');
  for (let v = (row.version || 0) + 1; v <= CURRENT_VERSION; v++) {
    if (v <= 2) await tx.exec(fs.readFileSync(path.join(__dirname, 'migrations', v === 1 ? '001-core.sql' : '002-integrity.sql'), 'utf8'));
    if (v === 2) {
      const legacy = await tx.all('SELECT id, company_id, role, activation_token, activation_token_expires FROM users WHERE activation_token IS NOT NULL AND is_active=0');
      for (const u of legacy) {
        const expires = Number(u.activation_token_expires);
        if (Number.isFinite(expires) && expires > 0) await tx.run('INSERT INTO invitations(user_id, company_id, token_hash, kind, expires_at) VALUES(?,?,?,?,?)', [u.id, u.company_id, hash(u.activation_token), u.role === 'employee' ? 'invitation' : 'activation', new Date(expires).toISOString()]);
      }
      await tx.run('UPDATE users SET activation_token=NULL, activation_token_expires=NULL');
    }
    if (v === 3) {
      const guards = {
        users: "NEW.normalized_email IS NULL OR NEW.normalized_email != LOWER(TRIM(NEW.email)) OR LENGTH(TRIM(NEW.name))=0 OR NEW.is_active NOT IN (0,1) OR NEW.is_active IS NULL OR (NEW.role IS NOT NULL AND NEW.role NOT IN ('manager','employee'))",
        locations: "NEW.latitude NOT BETWEEN -90 AND 90 OR NEW.longitude NOT BETWEEN -180 AND 180 OR NEW.radius<=0 OR NEW.radius>100000",
        attendance: "NEW.company_id IS NULL OR NEW.company_id IS NOT (SELECT company_id FROM users WHERE id=NEW.employee_id) OR (NEW.location_id IS NOT NULL AND NEW.company_id IS NOT (SELECT company_id FROM locations WHERE id=NEW.location_id)) OR NEW.check_in_latitude NOT BETWEEN -90 AND 90 OR NEW.check_in_longitude NOT BETWEEN -180 AND 180 OR julianday(NEW.check_in_time) IS NULL OR (NEW.check_out_time IS NOT NULL AND (julianday(NEW.check_out_time) IS NULL OR julianday(NEW.check_out_time)<julianday(NEW.check_in_time) OR NEW.check_out_latitude IS NULL OR NEW.check_out_longitude IS NULL OR NEW.check_out_latitude NOT BETWEEN -90 AND 90 OR NEW.check_out_longitude NOT BETWEEN -180 AND 180))",
      };
      for (const [table, expression] of Object.entries(guards)) for (const action of ['INSERT','UPDATE']) await tx.exec(`CREATE TRIGGER ${table}_validate_${action.toLowerCase()} BEFORE ${action} ON ${table} WHEN ${expression} BEGIN SELECT RAISE(ABORT, 'invalid ${table} data'); END;`);
      await tx.exec("CREATE TRIGGER users_keep_attendance_tenant BEFORE UPDATE OF company_id ON users WHEN OLD.company_id IS NOT NEW.company_id AND EXISTS(SELECT 1 FROM attendance WHERE employee_id=OLD.id) BEGIN SELECT RAISE(ABORT, 'attendance tenant membership is immutable'); END;");
    }
    if (v === 4) await tx.exec(fs.readFileSync(path.join(__dirname, 'migrations', '003-google.sql'), 'utf8'));
    await tx.run('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)',[v,new Date().toISOString()]);
  }
}
module.exports = { migrate, inspectLegacy, CURRENT_VERSION };
