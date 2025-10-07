
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { db } = require('../db/database');
const { sendAdminRegistrationNotification } = require('../services/emailService');

module.exports = function(passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        const { id, displayName, emails } = profile;
        const email = emails && emails.length > 0 ? emails[0].value : null;
        if (!email) {
          return done(new Error("Google profile did not return an email."), null);
        }
        const google_id = id;

        // Check if user exists
        db.get('SELECT * FROM users WHERE google_id = ? OR email = ?', [google_id, email], (err, user) => {
            if (err) { return done(err, null); }
            if (user) {
                // User exists, log them in
                // If they signed up with email first, then Google, link the account
                if (!user.google_id) {
                    db.run('UPDATE users SET google_id = ? WHERE id = ?', [google_id, user.id], (updateErr) => {
                        if (updateErr) return done(updateErr, null);
                        return done(null, user);
                    });
                } else {
                    return done(null, user);
                }
            } else {
                // Create a new user since one doesn't exist
                const insertSql = 'INSERT INTO users (google_id, name, email, is_active) VALUES (?, ?, ?, 1)'; // Automatically active
                db.run(insertSql, [google_id, displayName, email], function(err) {
                    if (err) { return done(err, null); }
                    const newUserId = this.lastID;

                    // Notify admin about the new registration
                    sendAdminRegistrationNotification(displayName, email).catch(e => console.error("Failed to send admin notification for new Google user:", e));

                    db.get('SELECT * FROM users WHERE id = ?', [newUserId], (err, newUser) => {
                        if (err) { return done(err, null); }
                        return done(null, newUser);
                    });
                });
            }
        });
      }
    )
  );
};
