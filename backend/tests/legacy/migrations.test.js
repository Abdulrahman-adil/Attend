const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../../db/database');
test('legacy SQLite migrations build schema and record version four without application records', async () => {
  const store = await openDatabase(':memory:', { applyMigrations: true });
  try {
    assert.equal((await store.read(tx => tx.get('SELECT MAX(version) AS version FROM schema_migrations'))).version, 4);
    assert.deepEqual(await store.inspect(), []);
    assert.equal((await store.read(tx => tx.get('SELECT COUNT(*) AS n FROM users'))).n, 0);
    assert.ok(await store.read(tx => tx.get("SELECT name FROM sqlite_master WHERE name='attendance'")));
  } finally { await store.close(); }
});
