const { Pool, types } = require('pg');
const { convertPlaceholders } = require('./sql');

// Preserve the numeric API contract; never silently round BIGINT identities/counts.
function safeInteger(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new RangeError('Database integer exceeds the supported API range.');
  return number;
}
function createPostgresStore(config = {}) {
  const logger = config.logger || console;
  const pool = new Pool({
    connectionString: config.databaseUrl || process.env.DATABASE_URL || undefined,
    ...(config.schema ? { options: `-c search_path=${validateSchema(config.schema)},public` } : {}),
    ...(config.ssl ? { ssl: config.ssl } : {}),
    max: config.max ?? 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
    idle_in_transaction_session_timeout: 30000,
    types: { getTypeParser: (oid, format) => oid === 20 && format !== 'binary' ? safeInteger : types.getTypeParser(oid, format) },
  });
  pool.on('error', () => logger.error(JSON.stringify({ event: 'database.pool_error' })));
  const adapter = connection => ({
    async get(sql, params = []) { return (await connection.query(convertPlaceholders(sql), params)).rows[0]; },
    async all(sql, params = []) { return (await connection.query(convertPlaceholders(sql), params)).rows; },
    async run(sql, params = []) {
      const result = await connection.query(convertPlaceholders(sql), params);
      return { id: result.rows[0]?.id ?? null, rowCount: result.rowCount, rows: result.rows };
    },
    async exec(sql) { await connection.query(sql); },
  });
  return {
    read: fn => fn(adapter(pool)),
    async transaction(fn) {
      const client = await pool.connect();
      let discard;
      try {
        await client.query('BEGIN');
        const result = await fn(adapter(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch (rollbackError) { discard = rollbackError; }
        throw error;
      } finally { client.release(discard); }
    },
    close: () => pool.end(),
    ping: async () => { await pool.query('SELECT 1'); },
  };
}
function validateSchema(schema) {
  if (!/^attend_test_[a-f0-9]+$/.test(schema)) throw new Error('Only isolated test schemas may override search_path.');
  return schema;
}
module.exports = { createPostgresStore, safeInteger };
