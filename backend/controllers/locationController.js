
const { db } = require('../db/database');

const addLocation = (req, res, next) => {
  const { name, latitude, longitude, radius } = req.body;
  const { company_id: companyId } = req.user;

  if (!name || latitude === undefined || longitude === undefined || radius === undefined) {
    res.status(400);
    return next(new Error('Please provide all location details'));
  }

  const sql = `INSERT INTO locations (company_id, name, latitude, longitude, radius) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [companyId, name, parseFloat(latitude), parseFloat(longitude), parseInt(radius)], function (err) {
    if (err) return next(err);
    res.status(201).json({
      id: this.lastID,
      companyId,
      name,
      latitude,
      longitude,
      radius,
    });
  });
};

const getLocations = (req, res, next) => {
  const { company_id: companyId } = req.user;
  const sql = `SELECT * FROM locations WHERE company_id = ?`;
  db.all(sql, [companyId], (err, rows) => {
    if (err) return next(err);
    res.json(rows);
  });
};

const deleteLocation = (req, res, next) => {
  const { id } = req.params;
  const { company_id: companyId } = req.user;

  const sql = `DELETE FROM locations WHERE id = ? AND company_id = ?`;
  db.run(sql, [id, companyId], function (err) {
    if (err) return next(err);
    if (this.changes === 0) {
      res.status(404);
      return next(new Error('Location not found or you do not have permission to delete it'));
    }
    res.json({ message: 'Location deleted successfully' });
  });
};

module.exports = { addLocation, getLocations, deleteLocation };
