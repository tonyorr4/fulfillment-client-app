/**
 * Migration: Add Automation System
 * - Creates automations table for storing automation rules
 * - Creates automation_logs table for execution tracking
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
        console.log('Starting automation system migration...');

        // Begin transaction
        await client.query('BEGIN');

        // 1. Create automations table
        console.log('Creating automations table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS automations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                trigger_event VARCHAR(100) NOT NULL,
                conditions JSONB NOT NULL DEFAULT '{"type": "group", "operator": "AND", "conditions": []}'::jsonb,
                actions JSONB NOT NULL DEFAULT '[]'::jsonb,
                enabled BOOLEAN DEFAULT true,
                execution_order INTEGER DEFAULT 0,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Create indexes for automations table
        console.log('Creating indexes on automations table...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_automations_trigger
            ON automations(trigger_event) WHERE enabled = true;
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_automations_order
            ON automations(execution_order);
        `);

        // 3. Create automation_logs table
        console.log('Creating automation_logs table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS automation_logs (
                id SERIAL PRIMARY KEY,
                automation_id INTEGER REFERENCES automations(id) ON DELETE SET NULL,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                trigger_event VARCHAR(100) NOT NULL,
                conditions_met BOOLEAN NOT NULL,
                actions_executed JSONB,
                error_message TEXT,
                execution_time_ms INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Create indexes for automation_logs table
        console.log('Creating indexes on automation_logs table...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_automation_logs_client
            ON automation_logs(client_id);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_automation_logs_created
            ON automation_logs(created_at DESC);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_automation_logs_automation
            ON automation_logs(automation_id);
        `);

        // Commit transaction
        await client.query('COMMIT');

        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('New tables created:');
        console.log('  - automations: Stores automation rules with conditions and actions');
        console.log('  - automation_logs: Tracks automation execution history');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Run seed-default-automations.js to create initial rules');
        console.log('  2. Update server.js to integrate automation engine');

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
