/**
 * Migration: Create automations table
 * This sets up the complete automation system
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('🔧 Starting migration: Create automations table...\n');

        // Check if table already exists
        const checkTable = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'automations'
        `);

        if (checkTable.rows.length > 0) {
            console.log('✅ Automations table already exists.');
            return;
        }

        console.log('📋 Creating automations table...');

        // Create automations table
        await client.query(`
            CREATE TABLE automations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                trigger_event VARCHAR(100) NOT NULL,
                conditions JSONB NOT NULL DEFAULT '{"type":"group","operator":"AND","conditions":[]}'::jsonb,
                actions JSONB NOT NULL DEFAULT '[]'::jsonb,
                enabled BOOLEAN DEFAULT true,
                execution_order INTEGER DEFAULT 0,
                trigger_on_enter BOOLEAN DEFAULT true,
                trigger_on_enter_status VARCHAR(50),
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Created automations table');

        // Create indexes
        await client.query(`
            CREATE INDEX idx_automations_trigger_event ON automations(trigger_event);
            CREATE INDEX idx_automations_enabled ON automations(enabled);
            CREATE INDEX idx_automations_execution_order ON automations(execution_order);
        `);

        console.log('✅ Created indexes on automations table');

        // Create automation_executions table for logging
        await client.query(`
            CREATE TABLE IF NOT EXISTS automation_executions (
                id SERIAL PRIMARY KEY,
                automation_id INTEGER REFERENCES automations(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                trigger_event VARCHAR(100),
                conditions_met BOOLEAN,
                actions_executed JSONB,
                execution_time_ms INTEGER,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Created automation_executions table');

        // Create index on automation_executions
        await client.query(`
            CREATE INDEX idx_automation_executions_automation_id ON automation_executions(automation_id);
            CREATE INDEX idx_automation_executions_client_id ON automation_executions(client_id);
            CREATE INDEX idx_automation_executions_created_at ON automation_executions(created_at DESC);
        `);

        console.log('✅ Created indexes on automation_executions table');

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📋 Tables created:');
        console.log('   • automations - Main automation rules');
        console.log('   • automation_executions - Execution history/logs');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate()
    .then(() => {
        console.log('\n🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Migration failed with error:', error.message);
        process.exit(1);
    });
