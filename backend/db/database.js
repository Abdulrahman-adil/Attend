const sqlite3 = require('sqlite3');
const { migrate, inspectLegacy, CURRENT_VERSION } = require('./migrations');
async function openDatabase(filename, { applyMigrations = false, readOnly = false } = {}) {
  const raw = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(filename, readOnly ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, error => error ? reject(error) : resolve(connection));
  });
  raw.configure('busyTimeout', 5000);
  const tx = {
    get: (sql, params = []) => new Promise((resolve,reject) => raw.get(sql,params,(e,row) => e ? reject(e) : resolve(row))),
    all: (sql, params = []) => new Promise((resolve,reject) => raw.all(sql,params,(e,rows) => e ? reject(e) : resolve(rows))),
    run: (sql, params = []) => new Promise((resolve,reject) => raw.run(sql,params,function(e) { e ? reject(e) : resolve({ lastID: this.lastID, changes: this.changes }); })),
    exec: sql => new Promise((resolve,reject) => raw.exec(sql,e => e ? reject(e) : resolve())),
  };
  await tx.exec('PRAGMA foreign_keys=ON');
  let tail = Promise.resolve();
  // Every operation on this connection participates in one queue, so unrelated reads/writes
  // cannot accidentally execute inside another request's transaction.
  const enqueue = fn => { const next = tail.then(fn); tail = next.catch(() => {}); return next; };
  const store = {
    read: fn => enqueue(() => fn(tx)),
    transaction: fn => enqueue(async () => {
      await tx.exec('BEGIN IMMEDIATE');
      try { const result = await fn(tx); await tx.exec('COMMIT'); return result; }
      catch (error) { await tx.exec('ROLLBACK'); throw error; }
    }),
    inspect: () => enqueue(() => inspectLegacy(tx)),
    close: () => enqueue(() => new Promise((resolve,reject) => raw.close(e => e ? reject(e) : resolve()))),
  };
  try {
    if (applyMigrations) await store.transaction(migrate);
    if (!readOnly) {
      const table = await store.read(t => t.get("SELECT name FROM sqlite_master WHERE name='schema_migrations'"));
      const version = table && await store.read(t => t.get('SELECT MAX(version) AS version FROM schema_migrations'));
      if (!version || version.version !== CURRENT_VERSION) throw new Error('Database migrations are pending. Back up the database, run npm run db:check, then npm run db:migrate.');
      await store.read(t => t.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;'));
    }
    return store;
  } catch (error) { await store.close(); throw error; }
}
module.exports = { openDatabase };
