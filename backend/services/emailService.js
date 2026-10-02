const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
function encrypt(payload, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
function decrypt(payload, key) {
  const value = Buffer.from(payload, "base64");
  const cipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    value.subarray(0, 12)
  );
  cipher.setAuthTag(value.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]).toString(
      "utf8"
    )
  );
}
async function queueEmail(
  tx,
  config,
  { eventKey, companyId = null, invitationId = null, kind, payload },
  now
) {
  await tx.run(
    "INSERT INTO email_outbox(event_key,company_id,invitation_id,kind,payload_encrypted,created_at,next_attempt_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT (event_key) DO NOTHING",
    [
      eventKey,
      companyId,
      invitationId,
      kind,
      encrypt(payload, config.outboxKey),
      now,
      now,
    ]
  );
}
function createMailer(config) {
  if (!config.emailEnabled) return null;
  if (
    !config.smtp.host ||
    !config.smtp.user ||
    !config.smtp.pass ||
    !config.emailFrom
  )
    throw new Error("EMAIL_ENABLED requires complete SMTP configuration.");
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    requireTLS: config.smtp.port !== 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    send: (mail) => transport.sendMail({ from: config.emailFrom, ...mail }),
    close: () => transport.close(),
  };
}
function compose(config, row, payload) {
  const common = {
    to: payload.to,
    messageId: `<attend-${row.id}-${crypto
      .createHash("sha256")
      .update(row.event_key)
      .digest("hex")
      .slice(0, 16)}@${new URL(config.frontendUrl).hostname}>`,
  };
  if (["invitation", "activation", "password_reset"].includes(row.kind)) {
    const link = `${config.frontendUrl}/#/activate/${encodeURIComponent(
      payload.token
    )}`;
    return {
      ...common,
      subject:
        row.kind === "password_reset"
          ? "Reset your attendance password"
          : "Your attendance account invitation",
      text: `Hello ${payload.name},\n\n${
        row.kind === "password_reset"
          ? "Choose a new password"
          : "Activate your account and, if requested, choose your own password"
      }:\n${link}\n\nThis link expires at ${
        payload.expiresAt
      }. A replacement link invalidates previous links.\nIf you did not expect this email, you can ignore it.\n`,
    };
  }
  if (row.kind === "activation_confirmation")
    return {
      ...common,
      subject: "Your attendance account is active",
      text: `Hello ${payload.name},\n\nYour attendance account was activated at ${payload.time}. You can sign in with your email address at ${config.frontendUrl}/#/login.\n`,
    };
  if (row.kind === "activation_manager")
    return {
      ...common,
      subject: "An employee activated their account",
      text: `${payload.name} activated their account at ${payload.time}. View your organization dashboard for details.\n`,
    };
  return {
    ...common,
    subject: `Attendance: ${payload.action}`,
    text: `${payload.name} ${payload.action} at ${payload.time}. View the attendance dashboard for the organization's local time.\n`,
  };
}
function createOutboxWorker({
  store,
  config,
  mailer,
  now = () => new Date(),
  logger = console,
}) {
  let running = false;
  async function drain(limit = 10) {
    if (!mailer || running) return;
    running = true;
    try {
      for (let i = 0; i < limit; i++) {
        const instant = now();
        const job = await store.transaction(async (tx) => {
          const row = await tx.get(
            "SELECT * FROM email_outbox WHERE (status='pending' AND next_attempt_at<=?) OR (status='sending' AND locked_until<=?) ORDER BY id LIMIT 1",
            [instant.toISOString(), instant.toISOString()]
          );
          if (!row) return null;
          if (row.invitation_id) {
            const invitation = await tx.get(
              "SELECT * FROM invitations WHERE id=?",
              [row.invitation_id]
            );
            if (
              !invitation ||
              invitation.consumed_at ||
              invitation.revoked_at ||
              invitation.expires_at <= instant.toISOString()
            ) {
              await tx.run(
                "UPDATE email_outbox SET status='cancelled',payload_encrypted=NULL WHERE id=?",
                [row.id]
              );
              return { cancelled: true };
            }
          }
          await tx.run(
            "UPDATE email_outbox SET status='sending',attempts=attempts+1,locked_until=? WHERE id=?",
            [new Date(instant.getTime() + 120000).toISOString(), row.id]
          );
          return row;
        });
        if (!job) break;
        if (job.cancelled) continue;
        try {
          const payload = decrypt(job.payload_encrypted, config.outboxKey);
          const receipt = await mailer.send(compose(config, job, payload));
          if (
            receipt &&
            Array.isArray(receipt.rejected) &&
            receipt.rejected.length
          )
            throw new Error("Recipient rejected");
          await store.transaction((tx) =>
            tx.run(
              "UPDATE email_outbox SET status='sent',sent_at=?,payload_encrypted=NULL,locked_until=NULL,last_error=NULL WHERE id=?",
              [now().toISOString(), job.id]
            )
          );
          logger.info(
            JSON.stringify({
              event: "email.sent",
              outboxId: job.id,
              kind: job.kind,
            })
          );
        } catch (error) {
          const attempts = job.attempts + 1;
          const code =
            typeof error.code === "string" &&
            /^[A-Z0-9_]{1,40}$/.test(error.code)
              ? error.code
              : "DELIVERY_FAILED";
          await store.transaction((tx) =>
            tx.run(
              "UPDATE email_outbox SET status=?,next_attempt_at=?,locked_until=NULL,last_error=? WHERE id=?",
              [
                attempts >= 5 ? "failed" : "pending",
                new Date(
                  now().getTime() + Math.min(3600000, 30000 * 2 ** attempts)
                ).toISOString(),
                code,
                job.id,
              ]
            )
          );
          logger.error(
            JSON.stringify({
              event: "email.failed",
              outboxId: job.id,
              kind: job.kind,
              code,
            })
          );
        }
      }
    } finally {
      running = false;
    }
  }
  return { drain };
}
module.exports = { queueEmail, createMailer, createOutboxWorker, decrypt };
