
const { db } = require('../db/database');

// Haversine formula to calculate distance between two lat/lon points in meters
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const isWithinRange = (currentLat, currentLon, allowedLocations) => {
  for (const location of allowedLocations) {
    const distance = calculateDistance(currentLat, currentLon, location.latitude, location.longitude);
    if (distance <= location.radius) {
      return true;
    }
  }
  return false;
};

const getLocationsForCompany = (companyId) => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM locations WHERE company_id = ?`;
        db.all(sql, [companyId], (err, rows) => {
            if (err) {
                reject(new Error("Failed to fetch company locations"));
            } else {
                resolve(rows);
            }
        });
    });
};

module.exports = { isWithinRange, getLocationsForCompany };
