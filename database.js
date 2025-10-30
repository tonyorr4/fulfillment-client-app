const { Pool } = require('pg');
require('dotenv').config();

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.on('connect', () => {
    console.log('✓ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Initialize database schema
async function initializeDatabase() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Users table (OAuth users with access control)
        // Note: This table is shared across all Sincro apps (Maintenance, Fulfillment, Access)
        // It may already exist from another app - CREATE TABLE IF NOT EXISTS will skip if exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                google_id VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                picture TEXT,
                role VARCHAR(50) DEFAULT 'Viewer',
                approved BOOLEAN DEFAULT FALSE,
                approved_by INTEGER,
                approved_at TIMESTAMP,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Access requests table
        // Note: This table is shared across all Sincro apps (Maintenance, Fulfillment, Access)
        // It may already exist from another app - CREATE TABLE IF NOT EXISTS will skip if exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS access_requests (
                id SERIAL PRIMARY KEY,
                google_id VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                department VARCHAR(255),
                reason TEXT,
                app_name VARCHAR(255) DEFAULT 'Sincro Fulfillment App',
                status VARCHAR(50) DEFAULT 'pending',
                reviewed_by INTEGER,
                reviewed_at TIMESTAMP,
                review_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Clients table (fulfillment requests)
        await client.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                client_id VARCHAR(50) UNIQUE NOT NULL,
                client_name VARCHAR(255) NOT NULL,
                client_email VARCHAR(255),
                est_inbound_date DATE NOT NULL,
                client_type VARCHAR(50) NOT NULL,
                avg_orders VARCHAR(50) NOT NULL,
                num_skus VARCHAR(50) NOT NULL,
                battery VARCHAR(10) NOT NULL,
                heavy_sku VARCHAR(10),
                num_pallets VARCHAR(50) NOT NULL,
                special_packaging VARCHAR(10) NOT NULL,
                barcoding VARCHAR(10) NOT NULL,
                additional_info TEXT,

                status VARCHAR(50) DEFAULT 'new-request',
                client_approved VARCHAR(50),
                auto_approved BOOLEAN DEFAULT false,

                sales_team VARCHAR(255) NOT NULL,
                fulfillment_ops VARCHAR(255) DEFAULT 'Ian',

                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Comments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id),
                comment_text TEXT NOT NULL,
                mentioned_users INTEGER[],
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Subtasks table
        await client.query(`
            CREATE TABLE IF NOT EXISTS subtasks (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                subtask_text TEXT NOT NULL,
                assignee VARCHAR(255),
                completed BOOLEAN DEFAULT false,
                auto_created BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        `);

        // Activity log table (for audit trail)
        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id),
                action VARCHAR(100) NOT NULL,
                details JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for better performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
            CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_comments_client_id ON comments(client_id);
            CREATE INDEX IF NOT EXISTS idx_subtasks_client_id ON subtasks(client_id);
            CREATE INDEX IF NOT EXISTS idx_activity_client_id ON activity_log(client_id);
        `);

        // Migrations run AFTER COMMIT to avoid transaction conflicts
        await client.query('COMMIT');

        // Migration: Make client_email optional (for existing databases)
        try {
            await pool.query(`
                ALTER TABLE clients ALTER COLUMN client_email DROP NOT NULL;
            `);
            console.log('✓ Migration: Made client_email optional');
        } catch (error) {
            // Ignore error if column already allows NULL or table doesn't exist yet
            console.log('  (Skipped migration: client_email already optional or table new)');
        }

        // Migration: Add access control columns to users table (for shared Sincro database)
        try {
            await pool.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'Viewer';
            `);
            await pool.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE;
            `);
            await pool.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by INTEGER;
            `);
            await pool.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
            `);
            await pool.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
            `);
            console.log('✓ Migration: Added access control columns to users table');
        } catch (error) {
            // Columns already exist from maintenance app - this is expected
            console.log('  (Skipped migration: users table already has access control columns)');
        }
        console.log('✓ Database schema initialized successfully');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error initializing database:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Helper function to get all clients
async function getAllClients() {
    const result = await pool.query(`
        SELECT c.*, u.name as created_by_name, u.email as created_by_email
        FROM clients c
        LEFT JOIN users u ON c.created_by = u.id
        ORDER BY c.created_at DESC
    `);
    return result.rows;
}

// Helper function to get client by ID
async function getClientById(id) {
    const result = await pool.query(`
        SELECT c.*, u.name as created_by_name, u.email as created_by_email
        FROM clients c
        LEFT JOIN users u ON c.created_by = u.id
        WHERE c.id = $1
    `, [id]);
    return result.rows[0];
}

// Helper function to create client
async function createClient(clientData) {
    const {
        client_id, client_name, client_email, est_inbound_date, client_type,
        avg_orders, num_skus, battery, heavy_sku, num_pallets,
        special_packaging, barcoding, additional_info,
        sales_team, fulfillment_ops, auto_approved, created_by
    } = clientData;

    const result = await pool.query(`
        INSERT INTO clients (
            client_id, client_name, client_email, est_inbound_date, client_type,
            avg_orders, num_skus, battery, heavy_sku, num_pallets,
            special_packaging, barcoding, additional_info,
            sales_team, fulfillment_ops, auto_approved, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
    `, [
        client_id, client_name, client_email, est_inbound_date, client_type,
        avg_orders, num_skus, battery, heavy_sku, num_pallets,
        special_packaging, barcoding, additional_info,
        sales_team, fulfillment_ops, auto_approved, created_by
    ]);

    return result.rows[0];
}

// Helper function to update client status
async function updateClientStatus(clientId, status, clientApproved = null) {
    const result = await pool.query(`
        UPDATE clients
        SET status = $1, client_approved = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
    `, [status, clientApproved, clientId]);

    return result.rows[0];
}

// Helper function to get subtasks for a client
async function getSubtasksByClientId(clientId) {
    const result = await pool.query(`
        SELECT * FROM subtasks
        WHERE client_id = $1
        ORDER BY created_at ASC
    `, [clientId]);
    return result.rows;
}

// Helper function to create subtask
async function createSubtask(clientId, subtaskText, assignee, autoCreated = false) {
    const result = await pool.query(`
        INSERT INTO subtasks (client_id, subtask_text, assignee, auto_created)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [clientId, subtaskText, assignee, autoCreated]);

    return result.rows[0];
}

// Helper function to toggle subtask completion
async function toggleSubtaskCompletion(subtaskId) {
    const result = await pool.query(`
        UPDATE subtasks
        SET completed = NOT completed,
            completed_at = CASE WHEN completed = false THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = $1
        RETURNING *
    `, [subtaskId]);

    return result.rows[0];
}

// Helper function to get comments for a client
async function getCommentsByClientId(clientId) {
    const result = await pool.query(`
        SELECT c.*, u.name as user_name, u.email as user_email, u.picture as user_picture
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.client_id = $1
        ORDER BY c.created_at ASC
    `, [clientId]);
    return result.rows;
}

// Helper function to create comment
async function createComment(clientId, userId, commentText, mentionedUsers = []) {
    const result = await pool.query(`
        INSERT INTO comments (client_id, user_id, comment_text, mentioned_users)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [clientId, userId, commentText, mentionedUsers]);

    return result.rows[0];
}

// Helper function to log activity
async function logActivity(clientId, userId, action, details = {}) {
    await pool.query(`
        INSERT INTO activity_log (client_id, user_id, action, details)
        VALUES ($1, $2, $3, $4)
    `, [clientId, userId, action, JSON.stringify(details)]);
}

// Helper function to find or create user
// Access control helper functions
async function createAccessRequest(googleId, email, name, department, reason) {
    try {
        const result = await pool.query(
            `INSERT INTO access_requests (google_id, email, name, department, reason, app_name, status, created_at)
             VALUES ($1, $2, $3, $4, $5, 'Sincro Fulfillment App', 'pending', NOW())
             RETURNING *`,
            [googleId, email, name, department, reason]
        );
        return { success: true, request: result.rows[0] };
    } catch (error) {
        console.error('Error creating access request:', error);
        return { success: false, error: error.message };
    }
}

async function getAccessRequestStatus(googleId, email) {
    try {
        const result = await pool.query(
            `SELECT * FROM access_requests
             WHERE (google_id = $1 OR email = $2)
             ORDER BY created_at DESC
             LIMIT 1`,
            [googleId, email]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        console.error('Error getting access request status:', error);
        return null;
    }
}

// Export pool and helper functions
module.exports = {
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
    logActivity,
    createAccessRequest,
    getAccessRequestStatus
};
