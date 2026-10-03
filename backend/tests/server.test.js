const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const request = require('supertest');
const { startServer } = require('../server');
const { openDatabase } = require('../db/database');
const { testConfig } = require('./helpers/app');

async function preparedConfig(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'attend-startup-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const config = testConfig({ DB_PATH: path.join(directory, 'test.sqlite'), PORT: '0' });
  const store = await openDatabase(config.dbPath, { applyMigrations: true });
  await store.close();
  return config;
}

test('server starts against a prepared database, serves HTTP and closes cleanly', async t => {
  const config = await preparedConfig(t);
  const runtime = await startServer({ config, logger: { info() {} } });
  try {
    assert.equal(runtime.server.listening, true);
    await request(runtime.server).get('/api/health').expect(200, { status: 'ok' });
    await request(runtime.server).get('/api/auth/session').expect(401);
    await assert.rejects(startServer({ config: { ...config, port: runtime.server.address().port }, logger: { info() {} } }), { code: 'EADDRINUSE' });
  } finally {
    await runtime.close();
    await runtime.close();
  }
  assert.equal(runtime.server.listening, false);
});

test('server connects to PostgreSQL database and serves health', async t => {
  const config = await preparedConfig(t);
  const runtime = await startServer({ config, logger: { info() {} } });
  try {
    assert.equal(runtime.server.listening, true);
    await request(runtime.server).get('/api/health').expect(200, { status: 'ok' });
  } finally {
    await runtime.close();
  }
  assert.equal(runtime.server.listening, false);
});

test('server.js entry point starts from another working directory and handles SIGTERM', { timeout: 10000 }, async t => {
  const config = await preparedConfig(t);
  const child = spawn(process.execPath, [path.join(__dirname, '../server.js')], {
    cwd: os.tmpdir(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      JWT_SECRET: config.secret,
      OUTBOX_ENCRYPTION_KEY: config.outboxKey.toString('base64'),
      FRONTEND_URL: config.frontendUrl,
      EMAIL_ENABLED: 'false',
      DB_PATH: config.dbPath,
      HOST: '127.0.0.1',
      PORT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
  });
  let output = '';
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  const url = await Promise.race([
    new Promise(resolve => child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/Server running on (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) resolve(match[1]);
    })),
    exited.then(result => { throw new Error(`Server exited before startup: ${JSON.stringify(result)} ${errors}`); }),
  ]);
  await request(url).get('/api/health').expect(200, { status: 'ok' });
  child.kill('SIGTERM');
  assert.deepEqual(await exited, { code: 0, signal: null });
});
