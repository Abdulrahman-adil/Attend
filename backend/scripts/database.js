require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const path = require('node:path');
const { openDatabase } = require('../db/database');
(async () => {
  const check = process.argv.includes('--check');
  const filename = path.resolve(process.env.DB_PATH || path.join(__dirname, '../db/attendance.db'));
  const store = await openDatabase(filename, { readOnly: check, applyMigrations: !check });
  try {
    const problems = await store.inspect();
    console.log(JSON.stringify({ operation: check ? 'read-only integrity check' : 'migrations applied', problems }));
    if (problems.length) process.exitCode = 1;
  } finally { await store.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
