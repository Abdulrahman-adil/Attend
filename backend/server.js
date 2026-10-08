const path = require('node:path');
const { createApp } = require('./app');
const { loadConfig } = require('./config');
const { createPostgresStore } = require('./db/postgres');
const { checkSchema } = require('./db/postgresMigrations');
const { createMailer, createOutboxWorker } = require('./services/emailService');

async function startServer({ config = loadConfig(), logger = console } = {}) {
  const store = createPostgresStore({ databaseUrl: config.databaseUrl, schema: config.testSchema, logger });
  let server, worker, interval, mailer, closing;
  try {
    await checkSchema(store); // Read-only: startup never applies migrations.
    mailer = createMailer(config);
    const app = createApp({ store, config });
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(config.port, config.host);
      listener.once('error', reject);
      listener.once('listening', () => { listener.removeListener('error', reject); resolve(listener); });
    });
    if (mailer) {
      worker = createOutboxWorker({ store, config, mailer, logger });
      const drain = () => worker.drain().catch(() => logger.error(JSON.stringify({ event: 'email.drain_failed' })));
      interval = setInterval(drain, 30000);
      interval.unref();
      void drain();
    }
    const close = () => {
      if (!closing) closing = (async () => {
        clearInterval(interval);
        try {
          await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
            server.closeIdleConnections?.();
          });
          await worker?.stop();
        } finally {
          mailer?.close();
          await store.close();
        }
      })();
      return closing;
    };
    logger.info(`Server running on http://${config.host}:${server.address().port}`);
    return { app, server, close };
  } catch (error) {
    clearInterval(interval);
    if (server) await new Promise(resolve => server.close(resolve));
    await worker?.stop();
    mailer?.close();
    await store.close();
    throw error;
  }
}
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
  startServer().then(({ close }) => {
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      const timeout = setTimeout(() => process.exit(1), 30000);
      timeout.unref();
      close().catch(() => { console.error('Shutdown failed.'); process.exitCode = 1; })
        .finally(() => clearTimeout(timeout));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }).catch(() => { console.error('Startup failed. Check required configuration, PostgreSQL connectivity, and manual migrations.'); process.exitCode = 1; });
}
module.exports = { startServer };
