
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');

const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const sql = `SELECT id, name, email, role, company_id FROM users WHERE id = ?`;
      db.get(sql, [decoded.id], (err, user) => {
        if (err) {
          return next(new Error('Database error fetching user'));
        }
        if (!user) {
          res.status(401);
          return next(new Error('Not authorized, user not found'));
        }
        req.user = user;
        next();
      });
    } catch (error) {
      res.status(401);
      next(new Error('Not authorized, token failed'));
    }
  }

  if (!token) {
    res.status(401);
    next(new Error('Not authorized, no token'));
  }
};

const manager = (req, res, next) => {
  if (req.user && req.user.role === 'manager') {
    next();
  } else {
    res.status(403);
    next(new Error('Not authorized as a manager'));
  }
};

module.exports = { protect, manager };
