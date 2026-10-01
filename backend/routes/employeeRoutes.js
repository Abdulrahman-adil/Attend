
const express = require('express');
const { wrap } = require('../lib/http');

function createEmployeeRoutes({ auth, controller }) {
  const router = express.Router();
  router.use(auth.protect, auth.manager);
  router.route('/').post(wrap(controller.add)).get(wrap(controller.list));
  router.post('/:id/resend', wrap(controller.resend));
  router.delete('/:id', wrap(controller.remove));
  return router;
}

module.exports = { createEmployeeRoutes };
