
const express = require('express');
const { wrap } = require('../lib/http');

function createLocationRoutes({ auth, controller }) {
  const router = express.Router();
  router.use(auth.protect);
  router.get('/', wrap(controller.list));
  router.post('/', auth.manager, wrap(controller.add));
  router.delete('/:id', auth.manager, wrap(controller.retire));
  return router;
}

module.exports = { createLocationRoutes };
