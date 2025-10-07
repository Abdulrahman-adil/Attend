
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { sendEmployeeCredentialsEmail } = require('../services/emailService');

const addEmployee = async (req, res, next) => {
  const { email, password } = req.body;
  const { company_id: companyId } = req.user;

  if (!email || !password) {
    res.status(400);
    return next(new Error('Please provide employee email and password'));
  }

  const findUserSql = `SELECT * FROM users WHERE email = ?`;
  db.get(findUserSql, [email], async (err, row) => {
    if (err) return next(err);
    if (row) {
      res.status(400);
      return next(new Error('An employee with this email already exists'));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const name = email.split('@')[0];

    const insertSql = `INSERT INTO users (name, email, password, role, company_id) VALUES (?, ?, ?, 'employee', ?)`;
    db.run(insertSql, [name, email, hashedPassword, companyId], async function (err) {
      if (err) return next(err);

      // Send email to new employee
      try {
        await sendEmployeeCredentialsEmail(email, password);
      } catch (emailError) {
        console.error("Failed to send employee credentials email:", emailError);
        // Don't fail the request, just log the error
      }
      
      res.status(201).json({
        id: this.lastID,
        name,
        email,
        companyId,
        role: 'employee',
      });
    });
  });
};

const getEmployees = (req, res, next) => {
  const { company_id: companyId } = req.user;
  const sql = `SELECT id, name, email FROM users WHERE company_id = ? AND role = 'employee'`;
  db.all(sql, [companyId], (err, rows) => {
    if (err) return next(err);
    res.json(rows);
  });
};

module.exports = { addEmployee, getEmployees };
