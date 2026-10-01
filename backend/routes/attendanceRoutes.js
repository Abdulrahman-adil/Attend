
const express = require('express');
const { wrap, fail } = require('../lib/http');

function createAttendanceRoutes({ auth, controller }) {
  const router = express.Router();
  router.use(auth.protect);
  router.post('/check-in', auth.employee, wrap(controller.checkIn));
  router.post('/check-out', auth.employee, wrap(controller.checkOut));
  router.post('/clock', auth.employee, wrap(() => {
    fail(409, 'Refresh to the updated attendance client before checking in or out.', 'CLIENT_UPGRADE_REQUIRED');
  }));
  router.get('/dashboard', auth.employee, wrap(controller.dashboard));
  router.get('/:employeeId', auth.manager, wrap(controller.history));
  return router;
}

module.exports = { createAttendanceRoutes };
