
const express = require('express');
const { updateUserRole } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/role').post(protect, updateUserRole);

module.exports = router;
