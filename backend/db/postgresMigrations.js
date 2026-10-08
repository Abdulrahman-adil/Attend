const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const directory = path.join(__dirname, 'postgres-migrations');
function migrations() {
  return fs.readdirSync(directory).filter(n => /^\d{3}-.*\.sql$/.test(n)).sort().map(name => {
    const sql = fs.readFileSync(path.join(directory, name), 'utf8');
    return { version: Number(name.slice(0, 3)), name, sql,
      checksum: crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex') };
  });
}
// Compare catalog metadata to the checked-in baseline before explicitly adopting it.
// Do not infer compatibility merely from the presence of tables.
async function inspectBaseline(tx, includeUpgrades = false) {
  const sql = (includeUpgrades ? migrations() : migrations().slice(0, 1)).map(m => m.sql).join('\n');
  const columns = await tx.all("SELECT table_name,column_name,udt_name,is_nullable,is_identity,column_default FROM information_schema.columns WHERE table_schema=current_schema()");
  const problems = [];
  const types = { BIGINT: 'int8', TEXT: 'text', BOOLEAN: 'bool', TIMESTAMPTZ: 'timestamptz', INTEGER: 'int4', 'DOUBLE PRECISION': 'float8', JSONB: 'jsonb' };
  for (const table of sql.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)) {
    for (const column of table[2].matchAll(/^\s+(\w+) (BIGINT|TEXT|BOOLEAN|TIMESTAMPTZ|INTEGER|DOUBLE PRECISION|JSONB)([^\n]*)/gm)) {
      const actual = columns.find(c => c.table_name === table[1] && c.column_name === column[1]);
      if (!actual || actual.udt_name !== types[column[2]] ||
          (/NOT NULL|PRIMARY KEY/.test(column[3]) && actual.is_nullable !== 'NO') ||
          (/IDENTITY/.test(column[3]) && actual.is_identity !== 'YES') ||
          (/DEFAULT (?!AS)/.test(column[3]) && !/IDENTITY/.test(column[3]) && actual.column_default === null))
        problems.push(table[1] + '.' + column[1]);
    }
  }
  const indexes = await tx.all("SELECT indexname FROM pg_indexes WHERE schemaname=current_schema()");
  for (const match of sql.matchAll(/CREATE (?:UNIQUE )?INDEX (\w+)/g))
    if (!indexes.some(i => i.indexname === match[1])) problems.push('index:' + match[1]);
  const constraints = await tx.all("SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname=current_schema() AND c.convalidated");
  for (const match of sql.matchAll(/(?:CONSTRAINT|ADD CONSTRAINT) (\w+)/g))
    if (!constraints.some(c => c.conname === match[1])) problems.push('constraint:' + match[1]);
  const triggers = await tx.all("SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema=current_schema()");
  for (const match of sql.matchAll(/CREATE TRIGGER (\w+)/g))
    if (!triggers.some(t => t.trigger_name === match[1])) problems.push('trigger:' + match[1]);
  if (includeUpgrades && columns.find(c => c.table_name === 'companies' && c.column_name === 'owner_id')?.is_nullable !== 'NO')
    problems.push('companies.owner_id nullability');
  if (problems.length) throw new Error('PostgreSQL baseline differs: ' + problems.join(', ') + '. Review schema; no automatic repair.');
}
async function checkSchema(store) {
  return store.read(async tx => {
    const table = await tx.get("SELECT to_regclass(current_schema() || '.schema_migrations') AS name");
    if (!table.name) throw new Error('PostgreSQL migrations are untracked. Run db:check and the documented manual migration procedure.');
    const applied = await tx.all('SELECT version,checksum FROM schema_migrations ORDER BY version');
    const expected = migrations();
    if (applied.length !== expected.length || expected.some((m, i) => applied[i]?.version !== m.version || applied[i]?.checksum !== m.checksum))
      throw new Error('PostgreSQL migrations are pending, unknown, or changed. Run the explicit migration command.');
    await inspectBaseline(tx, true);
    return { version: expected.at(-1).version };
  });
}
async function migrate(store, { baseline = false } = {}) {
  return store.transaction(async tx => {
    await tx.get("SELECT pg_advisory_xact_lock(734221, 1)");
    const tracked = await tx.get("SELECT to_regclass(current_schema() || '.schema_migrations') AS name");
    const present = await tx.all("SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE'");
    if (!tracked.name && present.length && !baseline)
      throw new Error('Existing untracked schema: inspect it and explicitly use db:baseline. No tables were changed.');
    if (baseline && (tracked.name || !present.length))
      throw new Error('Baseline adoption requires an existing, untracked schema.');
    if (baseline) await inspectBaseline(tx);
    await tx.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const applied = await tx.all('SELECT version,checksum FROM schema_migrations ORDER BY version');
    const expected = migrations();
    if (applied.some((a, i) => expected[i]?.version !== a.version || expected[i]?.checksum !== a.checksum))
      throw new Error('Unknown or modified migration history. No changes committed.');
    for (const m of expected) {
      if (applied.some(a => a.version === m.version)) continue;
      if (!(baseline && m.version === 1)) {
        // The historical baseline has its own transaction; the runner owns it now.
        await tx.exec(m.sql.replace(/^\s*BEGIN;\s*$/m, '').replace(/^\s*COMMIT;\s*$/m, ''));
      }
      await tx.run('INSERT INTO schema_migrations(version,name,checksum) VALUES($1,$2,$3)', [m.version, m.name, m.checksum]);
    }
    return { version: expected.at(-1).version };
  });
}
module.exports = { checkSchema, inspectBaseline, migrate, migrations };
