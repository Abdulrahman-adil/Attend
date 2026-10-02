const { Pool } = require("pg");
const { convertPlaceholders } = require("./sql");

function createPostgresStore(config = {}) {
  const pool = new Pool({
    connectionString:
      config.databaseUrl || process.env.DATABASE_URL || undefined,

    host: config.host || process.env.PGHOST,
    port: Number(config.port || process.env.PGPORT || 5432),
    database: config.database || process.env.PGDATABASE || "attend_pro",
    user: config.user || process.env.PGUSER,
    password: config.password || process.env.PGPASSWORD,

    max: Number(config.max || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  async function read(fn) {
    return fn({
      async get(sql, params = []) {
        const result = await pool.query(convertPlaceholders(sql), params);

        return result.rows[0];
      },

      async all(sql, params = []) {
        const result = await pool.query(convertPlaceholders(sql), params);

        return result.rows;
      },

      async run(sql, params = []) {
        const convertedSql = convertPlaceholders(sql);
        const result = await pool.query(convertPlaceholders(sql), params);

        return {
          lastID: result.rows[0]?.id ?? null,
          changes: result.rowCount,
          rows: result.rows,
        };
      },

      async exec(sql) {
        await pool.query(sql);
      },
    });
  }

  async function transaction(fn) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const tx = {
        async get(sql, params = []) {
          const result = await client.query(convertPlaceholders(sql), params);

          return result.rows[0];
        },

        async all(sql, params = []) {
          const result = await client.query(convertPlaceholders(sql), params);

          return result.rows;
        },

        async run(sql, params = []) {
          const convertedSql = convertPlaceholders(sql);
          const result = await client.query(convertPlaceholders(sql), params);

          return {
            lastID: result.rows[0]?.id ?? null,
            changes: result.rowCount,
            rows: result.rows,
          };
        },

        async exec(sql) {
          await client.query(sql);
        },
      };

      const result = await fn(tx);

      await client.query("COMMIT");

      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original error.
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async function close() {
    await pool.end();
  }

  async function ping() {
    const result = await pool.query(
      "SELECT current_database() AS database, current_user AS user"
    );

    return result.rows[0];
  }

  return {
    read,
    transaction,
    close,
    ping,
  };
}

module.exports = {
  createPostgresStore,
};
