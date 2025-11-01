const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { passport, ensureAuthenticated, checkAutoAdmin } = require('./auth-config');
const {
    pool,
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
const { triggerAutomations } = require('./automation-engine');
const {
    verifyConnection,
    sendMentionNotification,
    sendNewRequestNotification,
    sendClientSetupNotification,
    notifyTony,
    sendStatusChangeNotification,
    sendSubtaskCompletionNotification,
    sendApprovalDecisionNotification
} = require('./email-service');
const {
    autoMatchChannel,
    fetchChannelMessages,
    formatMessagesForSummary
} = require('./slack-service');
const {
    generateSlackSummary,
    updateIncrementalSummary
} = require('./claude-service');

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

// ==================== PERMISSION MIDDLEWARE ====================

// Middleware to block Sales users from admin-only actions
const blockSalesRole = (req, res, next) => {
    if (req.user && req.user.role === 'Sales') {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Sales users do not have permission to perform this action'
        });
    }
    next();
};

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

        // Create client data with default values (automations will modify these)
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
            fulfillment_ops: null, // Will be set by automation
            auto_approved: false, // Will be set by automation
            created_by: req.user.id,
            status: 'new-request' // Default status, will be changed by automation if auto-approved
        };

        console.log('💾 Creating client with data:', JSON.stringify(clientData, null, 2));

        let newClient = await createClient(clientData);

        console.log(`✓ Client created: ${newClient.client_id} | Initial status: ${newClient.status}`);

        // Trigger automations for client_created event
        console.log('🤖 Triggering automations for client_created event...');
        const automationSummary = await triggerAutomations(
            pool,
            'client_created',
            newClient.id,
            newClient,
            req.user.id
        );

        console.log(`✓ Automations completed: ${automationSummary.automationsExecuted}/${automationSummary.automationsTriggered} executed, ${automationSummary.totalActions} actions performed`);

        // Re-fetch client to get updated data from automations
        newClient = await getClientById(newClient.id);

        console.log(`✓ Final client state: Status: ${newClient.status} | Auto-approved: ${newClient.auto_approved} | Fulfillment Ops: ${newClient.fulfillment_ops}`);

        // Log activity
        await logActivity(newClient.id, req.user.id, 'client_created', {
            auto_approved: newClient.auto_approved,
            automation_summary: automationSummary
        });

        // Fetch sales team user for email notification
        const salesUserResult = await pool.query(
            'SELECT id, name, email FROM users WHERE name = $1 LIMIT 1',
            [salesTeam]
        );
        const salesTeamUser = salesUserResult.rows.length > 0 ? salesUserResult.rows[0] : null;

        // Send email notification to sales team and Tony (non-blocking)
        sendNewRequestNotification({
            ...newClient,
            sales_team: salesTeam,
            fulfillment_ops: 'Ian'
        }, salesTeamUser).catch(err => {
            console.error('❌ Email notification failed (non-blocking):', err.message);
        });

        res.status(201).json({
            success: true,
            client: newClient,
            autoApproved: newClient.auto_approved
        });
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

// Update client status
app.patch('/api/clients/:id/status', ensureAuthenticated, blockSalesRole, async (req, res) => {
    try {
        const { status, clientApproved } = req.body;

        // Get current client data to track old status
        const oldClient = await getClientById(req.params.id);
        const oldStatus = oldClient ? oldClient.status : null;

        let client = await updateClientStatus(req.params.id, status, clientApproved);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // Trigger automations for status_changed event
        console.log(`🤖 Triggering automations for status_changed event (${oldStatus} → ${status})...`);
        const automationSummary = await triggerAutomations(
            pool,
            'status_changed',
            client.id,
            client,
            req.user.id
        );

        console.log(`✓ Automations completed: ${automationSummary.automationsExecuted}/${automationSummary.automationsTriggered} executed, ${automationSummary.totalActions} actions performed`);

        // Re-fetch client to include any subtasks created by automations
        client = await getClientById(client.id);

        // Log activity
        await logActivity(client.id, req.user.id, 'status_changed', {
            new_status: status,
            old_status: oldStatus,
            client_approved: clientApproved,
            automation_summary: automationSummary
        });

        // Send status change notification to Tony (non-blocking)
        if (oldStatus && oldStatus !== status) {
            sendStatusChangeNotification(client, oldStatus, status).catch(err => {
                console.error('❌ Status change notification failed (non-blocking):', err.message);
            });
        }

        // If moved to client-setup, send email notifications (subtasks now created by automation)
        if (status === 'client-setup') {
            sendClientSetupNotification(client, client.sales_team, client.fulfillment_ops).catch(err => {
                console.error('❌ Client setup notification failed (non-blocking):', err.message);
            });
        }

        res.json({ success: true, client });
    } catch (error) {
        console.error('Error updating client status:', error);
        res.status(500).json({ error: 'Failed to update client status' });
    }
});

// Update client approval
app.patch('/api/clients/:id/approval', ensureAuthenticated, blockSalesRole, async (req, res) => {
    try {
        const { approval } = req.body; // 'yes', 'no', or 'auto-approve'

        let newStatus = '';
        let clientApproved = approval;

        if (approval === 'yes' || approval === 'auto-approve') {
            newStatus = 'signing';
        } else if (approval === 'no') {
            newStatus = 'not-pursuing';
        }

        let client = await updateClientStatus(req.params.id, newStatus, clientApproved);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // Trigger automations for approval_changed event
        console.log(`🤖 Triggering automations for approval_changed event (approval: ${approval})...`);
        const automationSummary = await triggerAutomations(
            pool,
            'approval_changed',
            client.id,
            client,
            req.user.id
        );

        console.log(`✓ Automations completed: ${automationSummary.automationsExecuted}/${automationSummary.automationsTriggered} executed`);

        // Re-fetch client to get any updates from automations
        client = await getClientById(client.id);

        // Log activity
        await logActivity(client.id, req.user.id, 'approval_changed', {
            approval,
            new_status: newStatus,
            automation_summary: automationSummary
        });

        // Send approval decision notification to Tony (non-blocking)
        sendApprovalDecisionNotification(client, approval, req.user).catch(err => {
            console.error('❌ Approval decision notification failed (non-blocking):', err.message);
        });

        res.json({ success: true, client });
    } catch (error) {
        console.error('Error updating client approval:', error);
        res.status(500).json({ error: 'Failed to update client approval' });
    }
});

// Update client details
app.patch('/api/clients/:id', ensureAuthenticated, blockSalesRole, async (req, res) => {
    try {
        const {
            client_name,
            client_email,
            client_type,
            avg_orders,
            num_skus,
            battery,
            heavy_sku,
            num_pallets,
            special_packaging,
            barcoding,
            additional_info,
            sales_team,
            fulfillment_ops
        } = req.body;


        // Build dynamic update query for provided fields
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (client_name !== undefined) {
            updates.push(`client_name = $${paramCount++}`);
            values.push(client_name);
        }
        if (client_email !== undefined) {
            updates.push(`client_email = $${paramCount++}`);
            values.push(client_email || null);
        }
        if (client_type !== undefined) {
            updates.push(`client_type = $${paramCount++}`);
            values.push(client_type);
        }
        if (avg_orders !== undefined) {
            updates.push(`avg_orders = $${paramCount++}`);
            values.push(avg_orders);
        }
        if (num_skus !== undefined) {
            updates.push(`num_skus = $${paramCount++}`);
            values.push(num_skus);
        }
        if (battery !== undefined) {
            updates.push(`battery = $${paramCount++}`);
            values.push(battery);
        }
        if (heavy_sku !== undefined) {
            updates.push(`heavy_sku = $${paramCount++}`);
            values.push(heavy_sku);
        }
        if (num_pallets !== undefined) {
            updates.push(`num_pallets = $${paramCount++}`);
            values.push(num_pallets);
        }
        if (special_packaging !== undefined) {
            updates.push(`special_packaging = $${paramCount++}`);
            values.push(special_packaging);
        }
        if (barcoding !== undefined) {
            updates.push(`barcoding = $${paramCount++}`);
            values.push(barcoding);
        }
        if (additional_info !== undefined) {
            updates.push(`additional_info = $${paramCount++}`);
            values.push(additional_info);
        }
        if (sales_team !== undefined) {
            updates.push(`sales_team = $${paramCount++}`);
            values.push(sales_team);
        }
        if (fulfillment_ops !== undefined) {
            updates.push(`fulfillment_ops = $${paramCount++}`);
            values.push(fulfillment_ops);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Add updated_at
        updates.push(`updated_at = NOW()`);

        // Add client ID as last parameter
        values.push(req.params.id);

        const query = `
            UPDATE clients
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const client = result.rows[0];

        // Log activity
        await logActivity(client.id, req.user.id, 'client_updated', {
            fields_updated: Object.keys(req.body)
        });

        res.json({ success: true, client });
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error: 'Failed to update client' });
    }
});

// Delete client
app.delete('/api/clients/:id', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        // Log activity BEFORE deleting (foreign key constraint requires client to exist)
        await logActivity(req.params.id, req.user.id, 'client_deleted', {});

        // Now delete the client
        await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);

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

        // Notify Tony of new subtask (non-blocking)
        const client = await getClientById(req.params.id);
        if (client) {
            notifyTony('subtask_created', client, {
                description: `New subtask created: "${subtaskText}" assigned to ${assignee}`
            }).catch(err => {
                console.error('❌ Subtask creation notification failed (non-blocking):', err.message);
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

        // Trigger automations when subtask is completed (not when uncompleted)
        if (subtask.completed) {
            const client = await getClientById(subtask.client_id);
            if (client) {
                console.log(`🤖 Triggering automations for subtask_completed event (subtask: ${subtask.subtask_text})...`);
                const automationSummary = await triggerAutomations(
                    pool,
                    'subtask_completed',
                    client.id,
                    client,
                    req.user.id
                );

                console.log(`✓ Automations completed: ${automationSummary.automationsExecuted}/${automationSummary.automationsTriggered} executed`);

                // Send notification to Tony (non-blocking)
                sendSubtaskCompletionNotification(client, subtask, req.user).catch(err => {
                    console.error('❌ Subtask completion notification failed (non-blocking):', err.message);
                });

                // Log activity with automation summary
                await logActivity(subtask.client_id, req.user.id, 'subtask_toggled', {
                    subtask_id: subtask.id,
                    completed: subtask.completed,
                    automation_summary: automationSummary
                });
            }
        } else {
            // Log activity for uncomplete (no automations)
            await logActivity(subtask.client_id, req.user.id, 'subtask_toggled', {
                subtask_id: subtask.id,
                completed: subtask.completed
            });
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

        // Notify Tony of assignee change (non-blocking)
        const client = await getClientById(subtask.client_id);
        if (client) {
            notifyTony('assignment_changed', client, {
                description: `Subtask "${subtask.subtask_text}" assignee changed to ${assignee}`
            }).catch(err => {
                console.error('❌ Assignment change notification failed (non-blocking):', err.message);
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
                    sendMentionNotification(
                        assignedUser,
                        req.user.name,
                        client.client_name,
                        commentText
                    ).catch(err => {
                        console.error('❌ Mention notification failed (non-blocking):', err.message);
                    });
                }
            }

            // Send email notifications to mentioned users
            if (mentionedUsers && mentionedUsers.length > 0) {
                for (const userId of mentionedUsers) {
                    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
                    if (userResult.rows.length > 0) {
                        const mentionedUser = userResult.rows[0];
                        sendMentionNotification(
                            mentionedUser,
                            req.user.name,
                            client.client_name,
                            commentText
                        ).catch(err => {
                            console.error('❌ Mention notification failed (non-blocking):', err.message);
                        });
                    }
                }
            }

            // Notify Tony of new comment (non-blocking)
            notifyTony('comment_added', client, {
                description: `New comment by ${req.user.name}: "${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}"`
            }).catch(err => {
                console.error('❌ Comment notification to Tony failed (non-blocking):', err.message);
            });
        }

        // Return comment with user info
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

// ==================== AUTOMATION MANAGEMENT ROUTES ====================

// Get all automations
app.get('/api/automations', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.*, u.name as created_by_name
             FROM automations a
             LEFT JOIN users u ON a.created_by = u.id
             ORDER BY a.execution_order ASC, a.id ASC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching automations:', error);
        res.status(500).json({ error: 'Failed to fetch automations' });
    }
});

// Get single automation by ID
app.get('/api/automations/:id', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT a.*, u.name as created_by_name
             FROM automations a
             LEFT JOIN users u ON a.created_by = u.id
             WHERE a.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Automation not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching automation:', error);
        res.status(500).json({ error: 'Failed to fetch automation' });
    }
});

// Create new automation
app.post('/api/automations', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const {
            name,
            description,
            trigger_event,
            conditions,
            actions,
            enabled = true,
            execution_order = 0
        } = req.body;

        // Validation
        if (!name || !trigger_event) {
            return res.status(400).json({ error: 'Name and trigger_event are required' });
        }

        if (!conditions || !actions) {
            return res.status(400).json({ error: 'Conditions and actions are required' });
        }

        // Validate trigger_event
        const validTriggers = ['client_created', 'status_changed', 'approval_changed', 'subtask_completed', 'client_updated'];
        if (!validTriggers.includes(trigger_event)) {
            return res.status(400).json({
                error: `Invalid trigger_event. Must be one of: ${validTriggers.join(', ')}`
            });
        }

        // Insert automation
        const result = await pool.query(
            `INSERT INTO automations
             (name, description, trigger_event, conditions, actions, enabled, execution_order, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                name,
                description || null,
                trigger_event,
                JSON.stringify(conditions),
                JSON.stringify(actions),
                enabled,
                execution_order,
                req.user.id
            ]
        );

        console.log(`✓ Created automation: "${name}" by ${req.user.name}`);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating automation:', error);
        res.status(500).json({ error: 'Failed to create automation' });
    }
});

// Update automation
app.patch('/api/automations/:id', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            trigger_event,
            conditions,
            actions,
            enabled,
            execution_order
        } = req.body;

        // Check if automation exists
        const existing = await pool.query('SELECT * FROM automations WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Automation not found' });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(description);
        }
        if (trigger_event !== undefined) {
            updates.push(`trigger_event = $${paramCount++}`);
            values.push(trigger_event);
        }
        if (conditions !== undefined) {
            updates.push(`conditions = $${paramCount++}`);
            values.push(JSON.stringify(conditions));
        }
        if (actions !== undefined) {
            updates.push(`actions = $${paramCount++}`);
            values.push(JSON.stringify(actions));
        }
        if (enabled !== undefined) {
            updates.push(`enabled = $${paramCount++}`);
            values.push(enabled);
        }
        if (execution_order !== undefined) {
            updates.push(`execution_order = $${paramCount++}`);
            values.push(execution_order);
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const result = await pool.query(
            `UPDATE automations SET ${updates.join(', ')}
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        console.log(`✓ Updated automation ID ${id} by ${req.user.name}`);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating automation:', error);
        res.status(500).json({ error: 'Failed to update automation' });
    }
});

// Toggle automation enabled/disabled
app.patch('/api/automations/:id/toggle', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE automations
             SET enabled = NOT enabled, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Automation not found' });
        }

        const automation = result.rows[0];
        console.log(`✓ Toggled automation "${automation.name}" to ${automation.enabled ? 'enabled' : 'disabled'}`);
        res.json(automation);
    } catch (error) {
        console.error('Error toggling automation:', error);
        res.status(500).json({ error: 'Failed to toggle automation' });
    }
});

// Delete automation
app.delete('/api/automations/:id', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Get automation info before deleting
        const automation = await pool.query('SELECT * FROM automations WHERE id = $1', [id]);
        if (automation.rows.length === 0) {
            return res.status(404).json({ error: 'Automation not found' });
        }

        // Delete automation (logs will be set to null due to ON DELETE SET NULL)
        await pool.query('DELETE FROM automations WHERE id = $1', [id]);

        console.log(`✓ Deleted automation "${automation.rows[0].name}" by ${req.user.name}`);
        res.json({ success: true, message: 'Automation deleted' });
    } catch (error) {
        console.error('Error deleting automation:', error);
        res.status(500).json({ error: 'Failed to delete automation' });
    }
});

// Update execution order for multiple automations
app.post('/api/automations/reorder', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const { automations } = req.body; // Array of { id, execution_order }

        if (!Array.isArray(automations)) {
            return res.status(400).json({ error: 'automations must be an array' });
        }

        // Update each automation's execution order
        for (const auto of automations) {
            await pool.query(
                'UPDATE automations SET execution_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [auto.execution_order, auto.id]
            );
        }

        console.log(`✓ Reordered ${automations.length} automations by ${req.user.name}`);
        res.json({ success: true, message: 'Automations reordered' });
    } catch (error) {
        console.error('Error reordering automations:', error);
        res.status(500).json({ error: 'Failed to reorder automations' });
    }
});

// ==================== AUTOMATION LOGS ROUTES ====================

// Get automation logs (paginated)
app.get('/api/automation-logs', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0, automation_id, client_id } = req.query;

        let query = `
            SELECT al.*, a.name as automation_name, c.client_name, c.client_id as client_identifier
            FROM automation_logs al
            LEFT JOIN automations a ON al.automation_id = a.id
            LEFT JOIN clients c ON al.client_id = c.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        if (automation_id) {
            query += ` AND al.automation_id = $${paramCount++}`;
            values.push(automation_id);
        }

        if (client_id) {
            query += ` AND al.client_id = $${paramCount++}`;
            values.push(client_id);
        }

        query += ` ORDER BY al.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM automation_logs WHERE 1=1';
        const countValues = [];
        let countParamCount = 1;

        if (automation_id) {
            countQuery += ` AND automation_id = $${countParamCount++}`;
            countValues.push(automation_id);
        }
        if (client_id) {
            countQuery += ` AND client_id = $${countParamCount++}`;
            countValues.push(client_id);
        }

        const countResult = await pool.query(countQuery, countValues);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            logs: result.rows,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + result.rows.length < total
            }
        });
    } catch (error) {
        console.error('Error fetching automation logs:', error);
        res.status(500).json({ error: 'Failed to fetch automation logs' });
    }
});

// Get single automation log
app.get('/api/automation-logs/:id', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT al.*, a.name as automation_name, c.client_name, c.client_id as client_identifier
             FROM automation_logs al
             LEFT JOIN automations a ON al.automation_id = a.id
             LEFT JOIN clients c ON al.client_id = c.id
             WHERE al.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Log not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching automation log:', error);
        res.status(500).json({ error: 'Failed to fetch automation log' });
    }
});

// Delete automation log
app.delete('/api/automation-logs/:id', ensureAuthenticated, checkAutoAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query('DELETE FROM automation_logs WHERE id = $1', [id]);

        res.json({ success: true, message: 'Log deleted' });
    } catch (error) {
        console.error('Error deleting automation log:', error);
        res.status(500).json({ error: 'Failed to delete log' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== SLACK INTEGRATION ROUTES ====================

// Get Slack summary for a client
app.get('/api/clients/:id/slack-summary', ensureAuthenticated, async (req, res) => {
    try {

        // Get summary from database
        const result = await pool.query(
            'SELECT * FROM slack_summaries WHERE client_id = $1 ORDER BY updated_at DESC LIMIT 1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                summary: null,
                message: 'No summary available yet. Click "Generate Summary" to create one.'
            });
        }

        res.json({
            success: true,
            summary: result.rows[0]
        });

    } catch (error) {
        console.error('Error fetching Slack summary:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

// Generate or refresh Slack summary for a client
app.post('/api/clients/:id/slack-summary/refresh', ensureAuthenticated, async (req, res) => {
    try {
        const clientId = req.params.id;

        // Get client details
        const clientResult = await pool.query(
            'SELECT id, client_name, slack_channel_id FROM clients WHERE id = $1',
            [clientId]
        );

        if (clientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const client = clientResult.rows[0];

        // Check if slack_channel_id is set
        if (!client.slack_channel_id) {
            return res.status(400).json({
                error: 'No Slack channel configured',
                message: 'Please set the Slack channel ID in client details first.'
            });
        }

        console.log(`🔄 Refreshing Slack summary for client: ${client.client_name}`);

        // Get existing summary to check for incremental update
        const existingSummaryResult = await pool.query(
            'SELECT * FROM slack_summaries WHERE client_id = $1 ORDER BY updated_at DESC LIMIT 1',
            [clientId]
        );

        const existingSummary = existingSummaryResult.rows.length > 0 ? existingSummaryResult.rows[0] : null;
        const lastTimestamp = existingSummary ? existingSummary.last_message_timestamp : null;

        // Fetch messages from Slack
        console.log('📥 Fetching messages from Slack...');
        const messages = await fetchChannelMessages(client.slack_channel_id, lastTimestamp);

        if (messages.length === 0 && existingSummary) {
            return res.json({
                success: true,
                message: 'No new messages since last summary.',
                summary: existingSummary
            });
        }

        if (messages.length === 0 && !existingSummary) {
            return res.status(400).json({
                error: 'No messages found',
                message: 'The Slack channel appears to be empty or inaccessible.'
            });
        }

        // Format messages for Claude
        const formattedMessages = formatMessagesForSummary(messages);

        // Generate or update summary
        let summaryText;
        const isInitial = !existingSummary;

        if (isInitial) {
            console.log('🤖 Generating initial summary...');
            summaryText = await generateSlackSummary(formattedMessages, client.client_name, true);
        } else {
            console.log('🤖 Updating incremental summary...');
            summaryText = await updateIncrementalSummary(
                existingSummary.summary_text,
                formattedMessages,
                client.client_name
            );
        }

        // Get the most recent message timestamp
        const mostRecentTimestamp = messages.reduce((latest, msg) => {
            return parseFloat(msg.ts) > parseFloat(latest) ? msg.ts : latest;
        }, messages[0].ts);

        // Save summary to database
        if (isInitial) {
            await pool.query(
                `INSERT INTO slack_summaries (client_id, summary_text, last_message_timestamp, message_count, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
                [clientId, summaryText, mostRecentTimestamp, messages.length]
            );
        } else {
            await pool.query(
                `UPDATE slack_summaries
                 SET summary_text = $1, last_message_timestamp = $2, message_count = message_count + $3, updated_at = NOW()
                 WHERE client_id = $4`,
                [summaryText, mostRecentTimestamp, messages.length, clientId]
            );
        }

        // Fetch updated summary
        const updatedResult = await pool.query(
            'SELECT * FROM slack_summaries WHERE client_id = $1 ORDER BY updated_at DESC LIMIT 1',
            [clientId]
        );

        console.log('✅ Summary generated successfully');

        res.json({
            success: true,
            message: isInitial ? 'Initial summary generated' : `Updated with ${messages.length} new messages`,
            summary: updatedResult.rows[0]
        });

    } catch (error) {
        console.error('Error generating Slack summary:', error);
        res.status(500).json({
            error: 'Failed to generate summary',
            message: error.message
        });
    }
});

// Auto-match Slack channel for a client
app.post('/api/clients/:id/slack-auto-match', ensureAuthenticated, async (req, res) => {
    try {
        const clientId = req.params.id;

        // Get client details
        const clientResult = await pool.query(
            'SELECT id, client_name FROM clients WHERE id = $1',
            [clientId]
        );

        if (clientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const client = clientResult.rows[0];

        console.log(`🔍 Auto-matching Slack channel for: ${client.client_name}`);

        // Try to auto-match channel
        const channelId = await autoMatchChannel(client.client_name);

        if (!channelId) {
            return res.status(404).json({
                error: 'Channel not found',
                message: `Could not find a Slack channel matching pattern: #client-${client.client_name.toLowerCase().replace(/\s+/g, '-')}`
            });
        }

        // Update client with found channel ID
        await pool.query(
            'UPDATE clients SET slack_channel_id = $1 WHERE id = $2',
            [channelId, clientId]
        );

        res.json({
            success: true,
            channel_id: channelId,
            message: 'Slack channel auto-matched successfully'
        });

    } catch (error) {
        console.error('Error auto-matching Slack channel:', error);
        res.status(500).json({
            error: 'Failed to auto-match channel',
            message: error.message
        });
    }
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

        // Verify Gmail connection
        await verifyConnection();

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
