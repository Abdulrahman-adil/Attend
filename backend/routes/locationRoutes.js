
const express = require('express');
const { addLocation, getLocations, deleteLocation } = require('../controllers/locationController');
const { protect, manager } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/')
  .post(protect, manager, addLocation)
  .get(protect, getLocations); // Both manager and employee can get locations

router.route('/:id').delete(protect, manager, deleteLocation);

module.exports = router;
