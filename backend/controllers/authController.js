const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { db } = require("../db/database");
const {
  sendActivationEmail,
  sendAdminRegistrationNotification,
} = require("../services/emailService");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

const registerUser = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    return next(new Error("Please provide name, email, and password"));
  }

  const findUserSql = `SELECT * FROM users WHERE email = ?`;
  db.get(findUserSql, [email], async (err, row) => {
    if (err) return next(err);
    if (row) {
      res.status(400);
      return next(new Error("User with this email already exists"));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const activationToken = crypto.randomBytes(20).toString("hex");
    const activationTokenExpires = Date.now() + 3600000; // 1 hour

    const insertSql = `INSERT INTO users (name, email, password, activation_token, activation_token_expires) VALUES (?, ?, ?, ?, ?)`;
    db.run(
      insertSql,
      [name, email, hashedPassword, activationToken, activationTokenExpires],
      function (err) {
        if (err) return next(err);

        res
          .status(201)
          .json({
            message:
              "Registration successful! Please check your email to activate your account.",
          });

        // Send emails in the background
        sendActivationEmail(email, activationToken).catch((err) =>
          console.error("Failed to send activation email:", err)
        );
        sendAdminRegistrationNotification(name, email).catch((err) =>
          console.error("Failed to send admin notification email:", err)
        );
      }
    );
  });
};

const loginUser = (req, res, next) => {
  const { name, password } = req.body;

  if (!name || !password) {
    res.status(400);
    return next(new Error("Please provide name and password"));
  }

  const sql = `SELECT * FROM users WHERE LOWER(name) = LOWER(?)`;
  db.get(sql, [name], async (err, user) => {
    if (err) return next(err);
    if (!user || user.google_id) {
      // Don't allow password login for Google users
      res.status(401);
      return next(new Error("Invalid credentials"));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401);
      return next(new Error("Invalid credentials"));
    }

    if (user.is_active !== 1) {
      res.status(401);
      return next(new Error("Account not activated. Please check your email."));
    }

    const token = generateToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.company_id,
      },
    });
  });
};

const activateUser = (req, res, next) => {
  // const { token } = req.body;
  const { token } = req.query.token; // Accept token as query parameter for easier activation link handling

  if (!token) {
    res.status(400);
    return next(new Error("Activation token is required"));
  }
  const findUserSql = `SELECT * FROM users WHERE activation_token = ? AND activation_token_expires > ?`;
  db.get(findUserSql, [token, Date.now()], (err, user) => {
    if (err) return next(err);
    if (!user) {
      res.status(400);
      return next(new Error("Invalid or expired activation token."));
    }
    const activateSql = `UPDATE users SET is_active = 1, activation_token = NULL, activation_token_expires = NULL WHERE id = ?`;
    db.run(activateSql, [user.id], function (err) {
      if (err) return next(err);
      res.json({
        message: "Account activated successfully! You can now log in.",
      });
    });
  });
};

const googleAuthCallback = (req, res) => {
  const token = generateToken(req.user.id);
  const user = JSON.stringify({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    companyId: req.user.company_id,
  });
  // Redirect to a specific frontend route with the token
  res.redirect(
    `${
      process.env.FRONTEND_URL
    }/#/auth/callback?token=${token}&user=${encodeURIComponent(user)}`
  );
};

module.exports = { registerUser, loginUser, activateUser, googleAuthCallback };
