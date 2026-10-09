const path = require('node:path');
const { createApp } = require('./app');
const { loadConfig } = require('./config');
const { createPostgresStore } = require('./db/postgres');
const { checkSchema } = require('./db/postgresMigrations');
const { createMailer, createOutboxWorker } = require('./services/emailService');

async function startServer({ config, logger = console } = {}) {
  let stage = 'configuration';
  let store;
  let server, worker, interval, mailer, closing;
  try {
    if (config === undefined) config = loadConfig();
    stage = 'postgres_initialization_connectivity';
    store = createPostgresStore({ databaseUrl: config.databaseUrl, schema: config.testSchema, logger });
    // The first schema query also establishes connectivity; add no diagnostic query.
    await checkSchema({ read: fn => store.read(tx => fn({ ...tx,
      async get(...args) {
        const row = await tx.get(...args);
        stage = 'schema_verification';
        return row;
      },
    })) }); // Read-only: startup never applies migrations.
    stage = 'application_initialization';
    mailer = createMailer(config);
    const app = createApp({ store, config });
    stage = 'http_server_binding';
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(config.port, config.host);
      listener.once('error', reject);
      listener.once('listening', () => { listener.removeListener('error', reject); resolve(listener); });
    });
    stage = 'email_worker_startup';
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
    const errorName = ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'URIError', 'AggregateError'].includes(error?.name) ? error.name : 'Unknown';
    const errorCode = typeof error?.code === 'string' && /^(?:E[A-Z0-9_]{1,63}|ERR_[A-Z0-9_]{1,60}|[0-9][A-Z0-9]{4}|CERT_[A-Z0-9_]{1,59}|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT_LOCALLY)$/.test(error.code) ? error.code : 'UNKNOWN';
    logger.error(JSON.stringify({ event: 'startup.failed', stage, errorName, errorCode }));
    clearInterval(interval);
    if (server) await new Promise(resolve => server.close(resolve));
    await worker?.stop();
    mailer?.close();
    await store?.close();
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
  }).catch(() => {
    process.exitCode = 1;
  });
}
module.exports = { startServer };
