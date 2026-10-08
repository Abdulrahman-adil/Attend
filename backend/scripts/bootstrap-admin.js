require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const { createPostgresStore } = require('../db/postgres');
const { checkSchema } = require('../db/postgresMigrations');
const { bootstrapAdmin } = require('../services/bootstrapAdmin');
(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const store = createPostgresStore();
  try {
    await checkSchema(store);
    await bootstrapAdmin(store, process.env.INITIAL_ADMIN_GOOGLE_SUB);
    console.log('Initial administrator established. Remove INITIAL_ADMIN_GOOGLE_SUB from operator configuration.');
  } finally { await store.close(); }
})().catch(() => { console.error('Admin bootstrap failed. Check schema, operator configuration, existing administrators, and Google account status.'); process.exitCode = 1; });
