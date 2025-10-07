
const { db } = require('../db/database');

const updateUserRole = (req, res, next) => {
  const { role } = req.body;
  const userId = req.user.id;

  if (!['manager', 'employee'].includes(role)) {
    res.status(400);
    return next(new Error('Invalid role specified'));
  }

  db.serialize(() => {
    db.get('SELECT company_id, role FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return next(err);
        if (user && user.role) {
            res.status(400);
            return next(new Error('User role is already set'));
        }

        if (role === 'manager') {
            const companyName = `${req.user.name}'s Company`;
            const insertCompanySql = 'INSERT INTO companies (name, owner_id) VALUES (?, ?)';
            db.run(insertCompanySql, [companyName, userId], function(err) {
                if (err) return next(err);
                const companyId = this.lastID;
                const updateUserSql = 'UPDATE users SET role = ?, company_id = ? WHERE id = ?';
                db.run(updateUserSql, [role, companyId, userId], (err) => {
                    if (err) return next(err);
                    res.json({ message: 'Role updated to manager and company created', role, companyId });
                });
            });
        } else { // Employee role
            const updateUserSql = 'UPDATE users SET role = ? WHERE id = ?';
            db.run(updateUserSql, [role, userId], (err) => {
                if (err) return next(err);
                // Note: An employee must be assigned a company by a manager.
                // This flow assumes an employee registers and waits for assignment, or is pre-added.
                res.json({ message: 'Role updated to employee', role });
            });
        }
    });
  });
};

module.exports = { updateUserRole };
