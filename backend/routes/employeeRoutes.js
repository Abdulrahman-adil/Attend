
const express = require('express');
const { addEmployee, getEmployees } = require('../controllers/employeeController');
const { protect, manager } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/').post(protect, manager, addEmployee).get(protect, manager, getEmployees);

module.exports = router;
