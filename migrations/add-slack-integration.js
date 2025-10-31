/**
 * Migration: Add Slack Integration fields
 * - Adds slack_channel_id to clients table
 * - Creates slack_summaries table
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('Starting Slack integration migration...');

        // Begin transaction
        await client.query('BEGIN');

        // 1. Add slack_channel_id to clients table
        console.log('Adding slack_channel_id column to clients table...');
        await client.query(`
            ALTER TABLE clients
            ADD COLUMN IF NOT EXISTS slack_channel_id VARCHAR(255);
        `);

        // 2. Create slack_summaries table
        console.log('Creating slack_summaries table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS slack_summaries (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                summary_text TEXT,
                last_message_timestamp VARCHAR(50),
                message_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 3. Create index on client_id for faster lookups
        console.log('Creating index on slack_summaries.client_id...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_slack_summaries_client_id
            ON slack_summaries(client_id);
        `);

        // Commit transaction
        await client.query('COMMIT');

        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('New fields added:');
        console.log('  - clients.slack_channel_id: Stores Slack channel ID for each client');
        console.log('  - slack_summaries table: Stores generated summaries with timestamps');

    } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration
runMigration()
    .then(() => {
        console.log('Migration script completed.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });
