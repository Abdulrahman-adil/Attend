const path = require('node:path');
function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const frontend = new URL(env.FRONTEND_URL || (production ? 'invalid-production-url' : 'http://localhost:5174'));
  if (!['http:', 'https:'].includes(frontend.protocol) || frontend.username || frontend.password || frontend.search || frontend.hash || (production && (frontend.protocol !== 'https:' || ['localhost','127.0.0.1'].includes(frontend.hostname)))) throw new Error('FRONTEND_URL must be the public HTTPS application origin in production.');
  const secret = env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('Set JWT_SECRET to a cryptographically random secret of at least 32 bytes.');
  const outboxKey = Buffer.from(env.OUTBOX_ENCRYPTION_KEY || '', 'base64');
  if (outboxKey.length !== 32) throw new Error('Set OUTBOX_ENCRYPTION_KEY to 32 random bytes encoded as base64. Keep this key for queued mail recovery.');
  const googleClientIds = ['GOOGLE_WEB_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID', 'GOOGLE_ANDROID_CLIENT_ID']
    .map(key => (env[key] || '').trim()).filter(Boolean);
  if (googleClientIds.some(id => !/^[\w-]+\.apps\.googleusercontent\.com$/.test(id))) throw new Error('Google client IDs must be valid Google OAuth client IDs.');
  return {
    production, secret, outboxKey, frontendUrl: frontend.origin,
    dbPath: path.resolve(env.DB_PATH || path.join(__dirname, 'db/attendance.db')),
    port: Number(env.PORT || 5001), host: env.HOST || '127.0.0.1',
    sessionMs: 8 * 60 * 60 * 1000, invitationMs: 24 * 60 * 60 * 1000,
    emailEnabled: env.EMAIL_ENABLED === 'true',
    smtp: { host: env.EMAIL_HOST, port: Number(env.EMAIL_PORT || 587), user: env.EMAIL_USER, pass: env.EMAIL_PASS },
    emailFrom: env.EMAIL_FROM || env.EMAIL_USER,
    google: { clientIds: [...new Set(googleClientIds)], webClientId: (env.GOOGLE_WEB_CLIENT_ID || '').trim() || null },
  };
}
module.exports = { loadConfig };
