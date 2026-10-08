const express = require('express');
const { wrap, fail } = require('../lib/http');

function createAuthRoutes({ auth, controller }) {
  const router = express.Router();
  router.post('/register', wrap(controller.register));
  router.post('/login', wrap(controller.login));
  router.post('/google', wrap(controller.googleLogin));
  router.post('/activate', wrap(controller.activate));
  router.post('/invitation/inspect', wrap(controller.inspectInvitation));
  router.post('/request-link', wrap(controller.requestLink));
  router.get('/session', auth.protect, wrap(controller.session));
  router.post('/logout', auth.protect, wrap(controller.logout));

  // Google Identity Services uses POST /google; there is no redirect callback flow.
  router.get(['/google', '/google/callback'], wrap(() => {
    fail(503, 'Use the Google sign-in button in the application.', 'GOOGLE_AUTH_UNAVAILABLE');
  }));
  return router;
}

module.exports = { createAuthRoutes };
