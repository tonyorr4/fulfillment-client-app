const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { findOrCreateUser } = require('./database');
require('dotenv').config();

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await findOrCreateUser(profile);

        // Check if user is active
        if (!user.active) {
            return done(null, false, { message: 'Your account has been deactivated' });
        }

        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const { pool } = require('./database');
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return done(new Error('User not found'), null);
        }

        const user = result.rows[0];

        // Check if user is still active
        if (!user.active) {
            return done(new Error('User account deactivated'), null);
        }

        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Authentication middleware
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
}

// Auto-admin middleware (Tony always gets admin access)
function checkAutoAdmin(req, res, next) {
    if (req.user && req.user.email === process.env.AUTO_ADMIN_EMAIL) {
        req.user.is_admin = true;
    }
    next();
}

module.exports = {
    passport,
    ensureAuthenticated,
    checkAutoAdmin
};
