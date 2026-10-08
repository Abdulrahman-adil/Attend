require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const { createPostgresStore } = require('../db/postgres');
const { checkSchema, inspectBaseline, migrate } = require('../db/postgresMigrations');
(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for explicit PostgreSQL commands.');
  const store = createPostgresStore();
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1 || !['--check', '--migrate', '--baseline'].includes(args[0])) throw new Error('Use --check, --migrate, or --baseline.');
    if (args[0] === '--check') { await store.read(inspectBaseline); await checkSchema(store); }
    else await migrate(store, { baseline: args[0] === '--baseline' });
    console.log('PostgreSQL schema check/migration completed.');
  } finally { await store.close(); }
})().catch(() => { console.error('PostgreSQL operation failed. Check connectivity, schema compatibility, and migration history; no automatic data repair was performed.'); process.exitCode = 1; });
