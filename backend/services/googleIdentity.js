const { OAuth2Client } = require('google-auth-library');
const { fail } = require('../lib/http');

function createGoogleIdentity(config) {
  const clientIds = config.google.clientIds;
  const client = clientIds.length ? new OAuth2Client() : null;
  return {
    enabled: Boolean(client),
    async verify(credential) {
      if (!client) fail(503, 'Google sign-in is not configured yet.', 'GOOGLE_AUTH_UNAVAILABLE');
      try {
        const ticket = await client.verifyIdToken({ idToken: credential, audience: clientIds });
        const payload = ticket.getPayload();
        if (!payload?.sub || !payload.email || payload.email_verified !== true) fail(401, 'Google did not provide a verified email address.', 'GOOGLE_IDENTITY_INVALID');
        return { subject: payload.sub, email: payload.email, name: payload.name || payload.email };
      } catch (error) {
        if (error.status && error.code) throw error;
        fail(401, 'Google sign-in could not be verified. Please try again.', 'GOOGLE_IDENTITY_INVALID');
      }
    },
  };
}

module.exports = { createGoogleIdentity };
