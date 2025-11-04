/**
 * Migration: Add trigger_on_enter column to automations table
 * This allows automations to only trigger when status actually changes (enters a new status)
 * rather than every time a client in that status is updated
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('🔧 Starting migration: Add trigger_on_enter to automations table...\n');

        // Check if column already exists
        const checkColumn = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'automations'
            AND column_name = 'trigger_on_enter'
        `);

        if (checkColumn.rows.length > 0) {
            console.log('✅ Column trigger_on_enter already exists in automations table.');
            return;
        }

        // Add trigger_on_enter column (default TRUE for backward compatibility)
        await client.query(`
            ALTER TABLE automations
            ADD COLUMN trigger_on_enter BOOLEAN DEFAULT true
        `);

        console.log('✅ Added trigger_on_enter column to automations table (default: true)');

        // Update existing "client-setup" automation to use trigger_on_enter
        const updateResult = await client.query(`
            UPDATE automations
            SET trigger_on_enter = true
            WHERE name LIKE '%client setup%'
            OR name LIKE '%Client Setup%'
            RETURNING id, name
        `);

        if (updateResult.rows.length > 0) {
            console.log('✅ Updated existing client setup automations:');
            updateResult.rows.forEach(row => {
                console.log(`   - ${row.name} (ID: ${row.id})`);
            });
        }

        console.log('\n✅ Migration completed successfully!');
        console.log('\nWhat trigger_on_enter does:');
        console.log('  - TRUE: Only trigger when status CHANGES (e.g., moving INTO client-setup)');
        console.log('  - FALSE: Trigger every time client is updated while IN that status');

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
