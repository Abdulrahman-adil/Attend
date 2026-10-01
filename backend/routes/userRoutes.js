const express = require('express');
const { wrap } = require('../lib/http');

function createUserRoutes({ auth, controller, employeeController }) {
  const router = express.Router();
  router.post('/role', auth.protect, wrap(controller.setRole));
  // Keep the existing URL, using tenant-scoped archival instead of deletion.
  router.delete('/users/:id', auth.protect, auth.manager, wrap(employeeController.remove));
  return router;
}

module.exports = { createUserRoutes };
