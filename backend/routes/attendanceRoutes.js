
const express = require('express');
const { clockInOut, getAttendance, getEmployeeDashboard } = require('../controllers/attendanceController');
const { protect, manager } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/clock', protect, clockInOut);
router.get('/dashboard', protect, getEmployeeDashboard);
router.get('/:employeeId', protect, manager, getAttendance);

module.exports = router;
