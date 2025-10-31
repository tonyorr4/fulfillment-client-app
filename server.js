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
    sendClientSetupNotification,
    notifyTony,
    sendStatusChangeNotification,
    sendSubtaskCompletionNotification,
    sendApprovalDecisionNotification
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

// Get all approved users (for assignee dropdown)
app.get('/api/users/all', ensureAuthenticated, async (req, res) => {
    try {
        const { pool } = require('./database');

        // Get only users who have active access to the Fulfillment app (app_id = 5)
        // Join with user_app_access to filter by app-specific access
        const result = await pool.query(
            `SELECT DISTINCT u.id, u.name, u.email, uaa.role, u.picture
             FROM users u
             JOIN user_app_access uaa ON u.id = uaa.user_id
             WHERE uaa.app_id = 5
               AND uaa.active = TRUE
             ORDER BY u.name ASC`
        );

        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// ==================== CLIENT ROUTES ====================

// Get all clients
app.get('/api/clients', ensureAuthenticated, async (req, res) => {
    try {
        const clients = await getAllClients();

        console.log(`📋 Fetched ${clients.length} clients from database`);

        // Also get subtasks for each client
        const clientsWithSubtasks = await Promise.all(clients.map(async (client) => {
            const subtasks = await getSubtasksByClientId(client.id);
            return {
                ...client,
                subtasks
            };
        }));

        console.log('📤 Sending clients to frontend - sample:', clientsWithSubtasks.length > 0 ? {
            client_id: clientsWithSubtasks[0].client_id,
            client_name: clientsWithSubtasks[0].client_name,
            sales_team: clientsWithSubtasks[0].sales_team,
            status: clientsWithSubtasks[0].status
        } : 'No clients');

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
        console.log('📝 New client request received:', JSON.stringify(req.body, null, 2));

        const {
            clientName, email, clientId, inboundDate, clientType,
            avgOrders, numSkus, battery, heavySku, numPallets,
            specialPackaging, barcoding, additionalInfo, salesTeam
        } = req.body;

        // Generate client ID if not provided
        const generatedClientId = clientId || `SFC-${Math.floor(Math.random() * 900 + 100)}`;

        // Check if manual review is required
        // DO NOT auto-approve if ANY of these conditions are true:
        // 1. Battery/DG goods = Yes
        // 2. Number of Pallets = 50-100 or >100
        // 3. Number of SKUs = 50-100 or >100
        const requiresManualReview =
            battery === 'Yes' ||
            numPallets === '50-100' || numPallets === '>100' ||
            numSkus === '50-100' || numSkus === '>100';

        // Auto-approve only if manual review is NOT required
        const autoApproved = !requiresManualReview;

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
            created_by: req.user.id,
            // Set status explicitly: 'signing' if auto-approved, 'new-request' if needs manual review
            status: autoApproved ? 'signing' : 'new-request'
        };

        console.log('💾 Creating client with data:', JSON.stringify(clientData, null, 2));

        const newClient = await createClient(clientData);

        console.log(`✓ Client created: ${newClient.client_id} | Status: ${newClient.status} | Auto-approved: ${autoApproved}`);
        console.log('✓ Client data stored:', JSON.stringify(newClient, null, 2));

        // Log activity
        await logActivity(newClient.id, req.user.id, 'client_created', {
            auto_approved: autoApproved
        });

        // Fetch sales team user for email notification
        const { pool } = require('./database');
        const salesUserResult = await pool.query(
            'SELECT id, name, email FROM users WHERE name = $1 LIMIT 1',
            [salesTeam]
        );
        const salesTeamUser = salesUserResult.rows.length > 0 ? salesUserResult.rows[0] : null;

        // Send email notification to sales team and Tony
        await sendNewRequestNotification({
            ...newClient,
            sales_team: salesTeam,
            fulfillment_ops: 'Ian'
        }, salesTeamUser);

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

        // Get current client data to track old status
        const oldClient = await getClientById(req.params.id);
        const oldStatus = oldClient ? oldClient.status : null;

        const client = await updateClientStatus(req.params.id, status, clientApproved);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // Log activity
        await logActivity(client.id, req.user.id, 'status_changed', {
            new_status: status,
            old_status: oldStatus,
            client_approved: clientApproved
        });

        // Send status change notification to Tony
        if (oldStatus && oldStatus !== status) {
            await sendStatusChangeNotification(client, oldStatus, status);
        }

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

        // Send approval decision notification to Tony
        await sendApprovalDecisionNotification(client, approval, req.user);

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

        // Notify Tony of new subtask
        const client = await getClientById(req.params.id);
        if (client) {
            await notifyTony('subtask_created', client, {
                description: `New subtask created: "${subtaskText}" assigned to ${assignee}`
            });
        }

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

        // Send notification to Tony when subtask is completed (not uncompleted)
        if (subtask.completed) {
            const client = await getClientById(subtask.client_id);
            if (client) {
                await sendSubtaskCompletionNotification(client, subtask, req.user);
            }
        }

        res.json({ success: true, subtask });
    } catch (error) {
        console.error('Error toggling subtask:', error);
        res.status(500).json({ error: 'Failed to toggle subtask' });
    }
});

// Update subtask assignee
app.patch('/api/subtasks/:id/assignee', ensureAuthenticated, async (req, res) => {
    try {
        const { assignee } = req.body;
        const { pool } = require('./database');

        if (!assignee) {
            return res.status(400).json({ error: 'Assignee parameter required' });
        }

        const result = await pool.query(
            `UPDATE subtasks
             SET assignee = $1
             WHERE id = $2
             RETURNING *`,
            [assignee, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subtask not found' });
        }

        const subtask = result.rows[0];

        // Log activity
        await logActivity(subtask.client_id, req.user.id, 'subtask_assignee_changed', {
            subtask_id: subtask.id,
            new_assignee: assignee
        });

        // Notify Tony of assignee change
        const client = await getClientById(subtask.client_id);
        if (client) {
            await notifyTony('assignment_changed', client, {
                description: `Subtask "${subtask.subtask_text}" assignee changed to ${assignee}`
            });
        }

        res.json({ success: true, subtask });
    } catch (error) {
        console.error('Error updating subtask assignee:', error);
        res.status(500).json({ error: 'Failed to update subtask assignee' });
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

        // Get client info for notifications
        const client = await getClientById(req.params.id);

        if (client) {
            const { pool } = require('./database');

            // Send email notifications to assigned users (sales team + fulfillment ops)
            const assignedUserNames = [client.sales_team, client.fulfillment_ops].filter(Boolean);
            for (const userName of assignedUserNames) {
                // Don't notify the person who wrote the comment
                if (userName === req.user.name) continue;

                const userResult = await pool.query(
                    'SELECT * FROM users WHERE name = $1 LIMIT 1',
                    [userName]
                );
                if (userResult.rows.length > 0) {
                    const assignedUser = userResult.rows[0];
                    await sendMentionNotification(
                        assignedUser,
                        req.user.name,
                        client.client_name,
                        commentText
                    );
                }
            }

            // Send email notifications to mentioned users
            if (mentionedUsers && mentionedUsers.length > 0) {
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

            // Notify Tony of new comment
            await notifyTony('comment_added', client, {
                description: `New comment by ${req.user.name}: "${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}"`
            });
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
