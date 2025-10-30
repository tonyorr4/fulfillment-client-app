// OAuth Authentication Configuration - Sincro Fulfillment App
// Implements secure access control with manual approval for all users except Tony

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { pool } = require('./database');
require('dotenv').config();

// OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const AUTO_APPROVE_ADMIN_EMAIL = process.env.AUTO_ADMIN_EMAIL || 'tony.orr@easyship.com';

// ==================== PASSPORT CONFIGURATION ====================

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            done(null, result.rows[0]);
        } else {
            done(null, false);
        }
    } catch (error) {
        done(error, null);
    }
});

// Google OAuth Strategy
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    console.log('✓ Registering Google OAuth Strategy');
    passport.use(new GoogleStrategy({
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        proxy: true // Important for Railway deployment
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const googleId = profile.id;
            const email = profile.emails[0].value;
            const name = profile.displayName;
            const picture = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

            // Check if user exists (by Google ID or email)
            const userResult = await pool.query(
                'SELECT * FROM users WHERE google_id = $1 OR email = $2',
                [googleId, email]
            );

            if (userResult.rows.length > 0) {
                // User exists - update last login and profile info
                const user = userResult.rows[0];

                await pool.query(
                    `UPDATE users
                     SET last_login = NOW(),
                         name = $1,
                         picture = $2,
                         email = $3,
                         google_id = $4,
                         updated_at = NOW()
                     WHERE id = $5`,
                    [name, picture, email, googleId, user.id]
                );

                // Check if user is approved
                if (!user.approved) {
                    // User exists but not approved yet
                    return done(null, false, {
                        message: 'pending_approval',
                        userId: user.id,
                        email: user.email
                    });
                }

                return done(null, user);
            } else {
                // New user - check if should auto-approve (for Tony only)
                if (email.toLowerCase() === AUTO_APPROVE_ADMIN_EMAIL.toLowerCase()) {
                    // Auto-approve Tony as Admin
                    console.log(`Auto-approving admin user: ${email}`);

                    const result = await pool.query(
                        `INSERT INTO users (google_id, email, name, picture, role, approved, approved_at, created_at)
                         VALUES ($1, $2, $3, $4, 'Admin', TRUE, NOW(), NOW())
                         RETURNING *`,
                        [googleId, email, name, picture]
                    );

                    console.log(`✓ Auto-approved ${email} as Admin (user_id: ${result.rows[0].id})`);
                    return done(null, result.rows[0]);
                }

                // All other users - check if they have a pending access request
                const accessRequestResult = await pool.query(
                    'SELECT * FROM access_requests WHERE google_id = $1 OR email = $2 ORDER BY created_at DESC LIMIT 1',
                    [googleId, email]
                );

                if (accessRequestResult.rows.length > 0) {
                    const request = accessRequestResult.rows[0];

                    if (request.status === 'pending') {
                        // Pending request exists
                        return done(null, false, {
                            message: 'request_pending',
                            email: email
                        });
                    } else if (request.status === 'denied') {
                        // Request was denied
                        return done(null, false, {
                            message: 'request_denied',
                            email: email,
                            reason: request.review_notes
                        });
                    }
                }

                // No user and no request - they need to request access
                return done(null, false, {
                    message: 'no_access_request',
                    googleId: googleId,
                    email: email,
                    name: name,
                    picture: picture
                });
            }
        } catch (error) {
            console.error('OAuth strategy error:', error);
            return done(error, null);
        }
    }));
} else {
    console.error('✗ Google OAuth Strategy NOT registered. Check environment variables.');
}

// ==================== MIDDLEWARE ====================

/**
 * Middleware to ensure user is authenticated and approved
 * Checks database on EVERY request to verify user still has access
 */
async function ensureAuthenticated(req, res, next) {
    // Check if user is authenticated via Passport (OAuth)
    if (req.isAuthenticated && req.isAuthenticated()) {
        // Verify user still exists and is approved in database
        try {
            const result = await pool.query(
                'SELECT * FROM users WHERE id = $1 AND approved = TRUE AND active = TRUE',
                [req.user.id]
            );

            if (result.rows.length === 0) {
                req.logout((err) => {
                    if (err) console.error('Logout error:', err);
                });
                return res.status(401).json({ error: 'User no longer has access' });
            }

            // Update req.user with fresh data from database
            req.user = result.rows[0];
            return next();
        } catch (error) {
            console.error('Error verifying user:', error);
            return res.status(500).json({ error: 'Authentication verification failed' });
        }
    }

    // No authentication found
    return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Auto-admin middleware (Tony always gets admin access)
 */
function checkAutoAdmin(req, res, next) {
    if (req.user && req.user.email && req.user.email.toLowerCase() === AUTO_APPROVE_ADMIN_EMAIL.toLowerCase()) {
        req.user.is_admin = true;
    }
    next();
}

// ==================== EXPORTS ====================

module.exports = {
    passport,
    ensureAuthenticated,
    checkAutoAdmin
};
