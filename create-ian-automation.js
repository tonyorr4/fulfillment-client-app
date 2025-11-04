/**
 * Create Ian Auto-Assignment Automation
 * Creates or updates the automation that assigns Ian to all new client tiles
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createIanAutomation() {
    const client = await pool.connect();

    try {
        console.log('Creating Ian auto-assignment automation...\n');

        // Begin transaction
        await client.query('BEGIN');

        // Get current user ID (try Tony first, fallback to any admin)
        const userResult = await client.query(`
            SELECT id, name, email FROM users
            WHERE email = $1 OR role = 'admin'
            LIMIT 1
        `, [process.env.AUTO_ADMIN_EMAIL || 'tony.orr@easyship.com']);

        const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null;
        console.log(`Using user ID: ${userId} (${userResult.rows[0]?.name || 'Unknown'})`);

        // Check if automation already exists
        const existingResult = await client.query(`
            SELECT id, enabled FROM automations
            WHERE name = 'Auto-assign Ian to fulfillment ops'
        `);

        if (existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];
            console.log(`\n⚠️  Automation already exists (ID: ${existing.id})`);
            console.log(`   Status: ${existing.enabled ? 'ENABLED' : 'DISABLED'}`);

            if (!existing.enabled) {
                // Enable it
                await client.query(`
                    UPDATE automations
                    SET enabled = true
                    WHERE id = $1
                `, [existing.id]);
                console.log('   ✅ Enabled the automation');
            } else {
                console.log('   ✅ Automation is already active');
            }

            await client.query('COMMIT');
            return;
        }

        // Create the automation
        const result = await client.query(`
            INSERT INTO automations (
                name,
                description,
                trigger_event,
                conditions,
                actions,
                enabled,
                execution_order,
                created_by
            )
            VALUES (
                'Auto-assign Ian to fulfillment ops',
                'Automatically assign Ian as the fulfillment ops for all new clients',
                'client_created',
                '{"type": "group", "operator": "AND", "conditions": []}'::jsonb,
                '[
                    {
                        "type": "set_field",
                        "field": "fulfillment_ops",
                        "value": "Ian"
                    }
                ]'::jsonb,
                true,
                0,
                $1
            )
            RETURNING id
        `, [userId]);

        const automationId = result.rows[0].id;

        // Commit transaction
        await client.query('COMMIT');

        console.log('\n✅ Automation created successfully!');
        console.log(`   ID: ${automationId}`);
        console.log('   Name: Auto-assign Ian to fulfillment ops');
        console.log('   Trigger: client_created (runs when new client is created)');
        console.log('   Conditions: None (applies to ALL new clients)');
        console.log('   Actions: Set fulfillment_ops = "Ian"');
        console.log('   Status: ENABLED');
        console.log('   Execution Order: 0 (runs first)');
        console.log('');
        console.log('📝 What this automation does:');
        console.log('   - Triggers whenever a new client tile is created');
        console.log('   - Automatically assigns "Ian" to the fulfillment_ops field');
        console.log('   - Runs before any other automations (execution_order: 0)');
        console.log('   - Works for ALL new clients (no conditions)');
        console.log('');
        console.log('✅ From now on, all new client tiles will automatically');
        console.log('   have Ian assigned as the fulfillment ops person!');

    } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error('\n❌ Error creating automation:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Database connection failed. Make sure:');
            console.error('   1. PostgreSQL is running');
            console.error('   2. DATABASE_URL in .env is correct');
            console.error('   3. You can connect to the database');
        } else if (error.code === '42P01') {
            console.error('\n💡 Automations table does not exist.');
            console.error('   Run this first: node migrations/add-automation-system.js');
        }

        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the script
createIanAutomation()
    .then(() => {
        console.log('\n✅ Script completed successfully.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed.');
        process.exit(1);
    });
