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

  // The previous Google integration still uses the removed database/auth API.
  router.get(['/google', '/google/callback'], wrap(() => {
    fail(503, 'Google sign-in is currently unavailable. Please sign in with your email and password.', 'GOOGLE_AUTH_UNAVAILABLE');
  }));
  return router;
}

module.exports = { createAuthRoutes };
