const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { passport, ensureAuthenticated, checkAutoAdmin } = require('./auth-config');
const {
    initializeDatabase,
    getAllClients,
    getClientById,
    createClient,
    updateClientStatus,
    getSubtasksByClientId,
    createSubtask,
    toggleSubtaskCompletion,
    getCommentsByClientId,
    createComment,
    logActivity
} = require('./database');
const {
    sendMentionNotification,
    sendNewRequestNotification,
    sendClientSetupNotification
} = require('./email-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (required for Railway deployment)
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for now
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Trust Railway's proxy (Railway is a legitimate reverse proxy)
    validate: { trustProxy: false }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.APP_URL]
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
    }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// ==================== AUTHENTICATION ROUTES ====================

// Google OAuth login
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/access-denied', failureMessage: true }),
    (req, res, next) => {
        // Success - user is approved
        res.redirect('/');
    },
    (err, req, res, next) => {
        // Handle authentication failure
        if (err) {
            console.error('OAuth callback error:', err);
            return res.redirect('/access-denied?error=oauth_error');
        }
        next();
    }
);

// Logout
app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        // Destroy session completely
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
            }
            // Clear session cookie
            res.clearCookie('connect.sid');
            // Redirect to Google OAuth login
            res.redirect('/auth/google');
        });
    });
});

// Get current user
app.get('/api/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email,
                picture: req.user.picture,
                role: req.user.role
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Submit access request
app.post('/api/auth/request-access', async (req, res) => {
    try {
        const { googleId, email, name, department, reason } = req.body;

        if (!googleId || !email || !name || !department || !reason) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const { createAccessRequest } = require('./database');
        const result = await createAccessRequest(googleId, email, name, department, reason);

        if (result.success) {
            res.json({
                success: true,
                message: 'Access request submitted successfully. You will be notified when approved.'
            });
        } else {
            res.status(500).json({ error: 'Failed to submit access request' });
        }
    } catch (error) {
        console.error('Error submitting access request:', error);
        res.status(500).json({ error: 'Failed to submit access request' });
    }
});

// Get users by role (for dropdowns)
app.get('/api/users/by-role', ensureAuthenticated, async (req, res) => {
    try {
        const { roles } = req.query; // Comma-separated roles: "Admin,Sales"
        const { pool } = require('./database');

        if (!roles) {
            return res.status(400).json({ error: 'Roles parameter required' });
        }

        const rolesArray = roles.split(',').map(r => r.trim());

        // Get approved users with specified roles, ordered by name
        const result = await pool.query(
            `SELECT id, name, email, role, picture
             FROM users
             WHERE approved = TRUE AND role = ANY($1)
             ORDER BY name ASC`,
            [rolesArray]
        );

        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        console.error('Error fetching users by role:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// ==================== CLIENT ROUTES ====================

// Get all clients
app.get('/api/clients', ensureAuthenticated, async (req, res) => {
    try {
        const clients = await getAllClients();

        // Also get subtasks for each client
        const clientsWithSubtasks = await Promise.all(clients.map(async (client) => {
            const subtasks = await getSubtasksByClientId(client.id);
            return {
                ...client,
                subtasks
            };
        }));

        res.json(clientsWithSubtasks);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// Get single client by ID
app.get('/api/clients/:id', ensureAuthenticated, async (req, res) => {
    try {
        const client = await getClientById(req.params.id);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const subtasks = await getSubtasksByClientId(client.id);
        const comments = await getCommentsByClientId(client.id);

        res.json({
            ...client,
            subtasks,
            comments
        });
    } catch (error) {
        console.error('Error fetching client:', error);
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

// Create new client (fulfillment request)
app.post('/api/clients', ensureAuthenticated, async (req, res) => {
    try {
        const {
            clientName, email, clientId, inboundDate, clientType,
            avgOrders, numSkus, battery, heavySku, numPallets,
            specialPackaging, barcoding, additionalInfo, salesTeam
        } = req.body;

        // Generate client ID if not provided
        const generatedClientId = clientId || `SFC-${Math.floor(Math.random() * 900 + 100)}`;

        // Check auto-approval criteria (matching N8N workflow)
        const autoApprovalCriteria = [
            battery === 'Yes',
            numPallets === '50-100' || numPallets === '>100',
            numSkus === '50-100' || numSkus === '>100',
            avgOrders === '>3000',
            clientType === 'Dropship'
        ];
        const autoApproved = autoApprovalCriteria.some(condition => condition === true);

        // Create client data
        const clientData = {
            client_id: generatedClientId,
            client_name: clientName,
            client_email: email || null,
            est_inbound_date: inboundDate,
            client_type: clientType,
            avg_orders: avgOrders,
            num_skus: numSkus,
            battery,
            heavy_sku: heavySku || null,
            num_pallets: numPallets,
            special_packaging: specialPackaging,
            barcoding,
            additional_info: additionalInfo || null,
            sales_team: salesTeam,
            fulfillment_ops: 'Ian', // Auto-assigned to Ian
            auto_approved: autoApproved,
            created_by: req.user.id
        };

        // If auto-approved, set status to signing
        if (autoApproved) {
            clientData.status = 'signing';
        }

        const newClient = await createClient(clientData);

        // Log activity
        await logActivity(newClient.id, req.user.id, 'client_created', {
            auto_approved: autoApproved
        });

        // Send email notification
        await sendNewRequestNotification({
            ...newClient,
            sales_team: salesTeam,
            fulfillment_ops: 'Ian'
        });

        res.status(201).json({
            success: true,
            client: newClient,
            autoApproved
        });
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

// Update client status
app.patch('/api/clients/:id/status', ensureAuthenticated, async (req, res) => {
    try {
        const { status, clientApproved } = req.body;
        const client = await updateClientStatus(req.params.id, status, clientApproved);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // Log activity
        await logActivity(client.id, req.user.id, 'status_changed', {
            new_status: status,
            client_approved: clientApproved
        });

        // If moved to client-setup, create auto-subtasks
        if (status === 'client-setup') {
            // Create security deposit confirmation subtask
            await createSubtask(
                client.id,
                'Security deposit confirmation',
                client.sales_team,
                true
            );

            // Create WMS setup subtask
            await createSubtask(
                client.id,
                'WMS Setup (Client and billing parameters)',
                client.fulfillment_ops,
                true
            );

            // Send email notifications to assignees
            await sendClientSetupNotification(client, client.sales_team, client.fulfillment_ops);
        }

        res.json({ success: true, client });
    } catch (error) {
        console.error('Error updating client status:', error);
        res.status(500).json({ error: 'Failed to update client status' });
    }
});

// Update client approval
app.patch('/api/clients/:id/approval', ensureAuthenticated, async (req, res) => {
    try {
        const { approval } = req.body; // 'yes', 'no', or 'auto-approve'

        let newStatus = '';
        let clientApproved = approval;

        if (approval === 'yes' || approval === 'auto-approve') {
            newStatus = 'signing';
        } else if (approval === 'no') {
            newStatus = 'not-pursuing';
        }

        const client = await updateClientStatus(req.params.id, newStatus, clientApproved);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // Log activity
        await logActivity(client.id, req.user.id, 'approval_changed', {
            approval,
            new_status: newStatus
        });

        res.json({ success: true, client });
    } catch (error) {
        console.error('Error updating client approval:', error);
        res.status(500).json({ error: 'Failed to update client approval' });
    }
});

// Delete client
app.delete('/api/clients/:id', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const { pool } = require('./database');
        await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);

        // Log activity
        await logActivity(req.params.id, req.user.id, 'client_deleted', {});

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});

// ==================== SUBTASK ROUTES ====================

// Get subtasks for a client
app.get('/api/clients/:id/subtasks', ensureAuthenticated, async (req, res) => {
    try {
        const subtasks = await getSubtasksByClientId(req.params.id);
        res.json(subtasks);
    } catch (error) {
        console.error('Error fetching subtasks:', error);
        res.status(500).json({ error: 'Failed to fetch subtasks' });
    }
});

// Create new subtask
app.post('/api/clients/:id/subtasks', ensureAuthenticated, async (req, res) => {
    try {
        const { subtaskText, assignee } = req.body;
        const subtask = await createSubtask(req.params.id, subtaskText, assignee, false);

        // Log activity
        await logActivity(req.params.id, req.user.id, 'subtask_created', {
            subtask_text: subtaskText,
            assignee
        });

        res.status(201).json({ success: true, subtask });
    } catch (error) {
        console.error('Error creating subtask:', error);
        res.status(500).json({ error: 'Failed to create subtask' });
    }
});

// Toggle subtask completion
app.patch('/api/subtasks/:id/toggle', ensureAuthenticated, async (req, res) => {
    try {
        const subtask = await toggleSubtaskCompletion(req.params.id);

        if (!subtask) {
            return res.status(404).json({ error: 'Subtask not found' });
        }

        // Log activity
        await logActivity(subtask.client_id, req.user.id, 'subtask_toggled', {
            subtask_id: subtask.id,
            completed: subtask.completed
        });

        res.json({ success: true, subtask });
    } catch (error) {
        console.error('Error toggling subtask:', error);
        res.status(500).json({ error: 'Failed to toggle subtask' });
    }
});

// ==================== COMMENT ROUTES ====================

// Get comments for a client
app.get('/api/clients/:id/comments', ensureAuthenticated, async (req, res) => {
    try {
        const comments = await getCommentsByClientId(req.params.id);
        res.json(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Create new comment
app.post('/api/clients/:id/comments', ensureAuthenticated, async (req, res) => {
    try {
        const { commentText, mentionedUsers } = req.body;
        const comment = await createComment(
            req.params.id,
            req.user.id,
            commentText,
            mentionedUsers || []
        );

        // Log activity
        await logActivity(req.params.id, req.user.id, 'comment_added', {
            comment_text: commentText,
            mentioned_users: mentionedUsers
        });

        // Send email notifications to mentioned users
        if (mentionedUsers && mentionedUsers.length > 0) {
            const { pool } = require('./database');
            const client = await getClientById(req.params.id);

            for (const userId of mentionedUsers) {
                const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
                if (userResult.rows.length > 0) {
                    const mentionedUser = userResult.rows[0];
                    await sendMentionNotification(
                        mentionedUser,
                        req.user.name,
                        client.client_name,
                        commentText
                    );
                }
            }
        }

        // Return comment with user info
        const { pool } = require('./database');
        const result = await pool.query(`
            SELECT c.*, u.name as user_name, u.email as user_email, u.picture as user_picture
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.id = $1
        `, [comment.id]);

        res.status(201).json({ success: true, comment: result.rows[0] });
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

// ==================== UTILITY ROUTES ====================

// Export data (backup)
app.get('/api/export', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const clients = await getAllClients();

        const fullExport = await Promise.all(clients.map(async (client) => {
            const subtasks = await getSubtasksByClientId(client.id);
            const comments = await getCommentsByClientId(client.id);

            return {
                ...client,
                subtasks,
                comments
            };
        }));

        res.json({
            exported_at: new Date().toISOString(),
            data: fullExport
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== CATCH-ALL ROUTE ====================

// Serve access request page for denied access
app.get('/access-denied', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'access-request.html'));
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== START SERVER ====================

async function startServer() {
    try {
        // Initialize database
        await initializeDatabase();

        // Start server
        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   Sincro Fulfillment Client App                ║
║   Server running on port ${PORT}                    ║
║   Environment: ${process.env.NODE_ENV || 'development'}                      ║
║                                                  ║
║   Ready to accept connections!                  ║
║                                                  ║
╚══════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
