const { Pool } = require('pg');
require('dotenv').config();

// Use production database URL directly
const pool = new Pool({
    connectionString: 'postgresql://postgres:UsXVgqVNrIcFFSwdHpoNSkGGdhKskaHr@metro.proxy.rlwy.net:49366/railway',
    ssl: { rejectUnauthorized: false }
});

async function addAttachments() {
    try {
        console.log('Adding attachments table...\n');

        // Create attachments table
        console.log('1. Creating attachments table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS attachments (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                file_name VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                file_size INTEGER NOT NULL,
                file_type VARCHAR(100),
                file_path TEXT NOT NULL,
                uploaded_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ attachments table created');

        // Create indexes for faster queries
        console.log('2. Creating indexes...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_attachments_client_id
            ON attachments(client_id)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by
            ON attachments(uploaded_by)
        `);
        console.log('   ✅ Indexes created');

        console.log('\n✅ Migration completed successfully!\n');
        console.log('Attachments table supports:');
        console.log('  - File metadata storage');
        console.log('  - Multiple attachments per client');
        console.log('  - File upload tracking');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

addAttachments();
