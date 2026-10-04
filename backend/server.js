const path = require("node:path");
const { createApp } = require("./app");
const { loadConfig } = require("./config");
const { createPostgresStore } = require("./db/postgres");
const { createMailer, createOutboxWorker } = require("./services/emailService");

async function startServer({ config = loadConfig(), logger = console } = {}) {
  const store = createPostgresStore({
    databaseUrl: config.databaseUrl,
  });
  let server;
  try {
    const app = createApp({ store, config });
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(config.port, config.host);
      listener.once("error", reject);
      listener.once("listening", () => {
        listener.removeListener("error", reject);
        resolve(listener);
      });
    });
    let closing;
    const close = () => {
      if (!closing)
        closing = (async () => {
          try {
            await new Promise((resolve, reject) => {
              server.close((error) => (error ? reject(error) : resolve()));
              server.closeIdleConnections?.();
            });
          } finally {
            await store.close();
          }
        })();
      return closing;
    };
    logger.info(
      `Server running on http://${config.host}:${server.address().port}`
    );
    let emailInterval = null;
    let mailer = null;
    let outboxWorker = null;
    if (config.emailEnabled) {
      try {
        mailer = createMailer(config);
        outboxWorker = createOutboxWorker({ store, config, mailer, logger });
        emailInterval = setInterval(() => {
          outboxWorker.drain().catch((err) => {
            logger.error(
              JSON.stringify({ event: "email.drain.error", error: err.message })
            );
          });
        }, 30000);
        emailInterval.unref();
        logger.info(JSON.stringify({ event: "email.worker.started" }));
      } catch (err) {
        logger.error(
          JSON.stringify({ event: "email.worker.start_failed", error: err.message })
        );
      }
    }
    const originalClose = close;
    const enhancedClose = () => {
      if (emailInterval) {
        clearInterval(emailInterval);
        emailInterval = null;
      }
      if (mailer && typeof mailer.close === "function") {
        try {
          mailer.close();
        } catch (_) {
          // ignore cleanup errors
        }
      }
      return originalClose();
    };
    return { app, server, close: enhancedClose };
  } catch (error) {
    if (server) await new Promise((resolve) => server.close(resolve));
    await store.close();
    throw error;
  }
}

if (require.main === module) {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
  startServer()
    .then(({ close }) => {
      let shuttingDown = false;
      const shutdown = () => {
        if (shuttingDown) return;
        shuttingDown = true;
        const timeout = setTimeout(() => process.exit(1), 10000);
        timeout.unref();
        close()
          .catch((error) => {
            console.error(`Shutdown failed: ${error.message}`);
            process.exitCode = 1;
          })
          .finally(() => clearTimeout(timeout));
      };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    })
    .catch((error) => {
      console.error(`Startup failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { startServer };
