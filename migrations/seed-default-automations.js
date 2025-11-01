/**
 * Migration: Seed Default Automations
 * Creates initial automation rules to replicate existing hard-coded behavior
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
        console.log('Starting default automations seed...');

        // Begin transaction
        await client.query('BEGIN');

        // Get Tony's user ID for created_by field
        const tonyResult = await client.query(
            `SELECT id FROM users WHERE email = $1 LIMIT 1`,
            [process.env.AUTO_ADMIN_EMAIL || 'tony.orr@easyship.com']
        );
        const tonyId = tonyResult.rows.length > 0 ? tonyResult.rows[0].id : null;

        console.log(`Using user ID: ${tonyId} for created_by field`);

        // ==================== AUTOMATION 1: Auto-Assign Ian ====================
        console.log('\n1. Creating automation: Auto-assign Ian to fulfillment ops');

        await client.query(`
            INSERT INTO automations (name, description, trigger_event, conditions, actions, enabled, execution_order, created_by)
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
        `, [tonyId]);

        console.log('   ✓ Created: Auto-assign Ian (execution_order: 0)');

        // ==================== AUTOMATION 2: Auto-Approve Simple Clients ====================
        console.log('\n2. Creating automation: Auto-approve simple clients');

        await client.query(`
            INSERT INTO automations (name, description, trigger_event, conditions, actions, enabled, execution_order, created_by)
            VALUES (
                'Auto-approve simple clients',
                'Automatically approve clients with no batteries, low SKU count, and low pallet count',
                'client_created',
                '{
                    "type": "group",
                    "operator": "AND",
                    "conditions": [
                        {
                            "type": "condition",
                            "field": "battery",
                            "operator": "equals",
                            "value": "No"
                        },
                        {
                            "type": "condition",
                            "field": "num_pallets",
                            "operator": "not_in",
                            "value": ["50-100", ">100"]
                        },
                        {
                            "type": "condition",
                            "field": "num_skus",
                            "operator": "not_in",
                            "value": ["50-100", ">100"]
                        }
                    ]
                }'::jsonb,
                '[
                    {
                        "type": "set_field",
                        "field": "status",
                        "value": "signing"
                    },
                    {
                        "type": "set_field",
                        "field": "auto_approved",
                        "value": true
                    }
                ]'::jsonb,
                true,
                1,
                $1
            )
        `, [tonyId]);

        console.log('   ✓ Created: Auto-approve simple clients (execution_order: 1)');
        console.log('   Conditions: battery=No AND num_pallets NOT IN [50-100, >100] AND num_skus NOT IN [50-100, >100]');
        console.log('   Actions: Set status=signing, Set auto_approved=true');

        // ==================== AUTOMATION 3: Create Client Setup Subtasks ====================
        console.log('\n3. Creating automation: Create client setup subtasks');

        await client.query(`
            INSERT INTO automations (name, description, trigger_event, conditions, actions, enabled, execution_order, created_by)
            VALUES (
                'Create client setup subtasks',
                'Auto-create security deposit and WMS setup subtasks when client moves to setup phase',
                'status_changed',
                '{
                    "type": "condition",
                    "field": "status",
                    "operator": "equals",
                    "value": "client-setup"
                }'::jsonb,
                '[
                    {
                        "type": "create_subtask",
                        "text": "Security deposit confirmation",
                        "assignee_field": "sales_team",
                        "mark_auto_created": true
                    },
                    {
                        "type": "create_subtask",
                        "text": "WMS Setup (Client and billing parameters)",
                        "assignee_field": "fulfillment_ops",
                        "mark_auto_created": true
                    }
                ]'::jsonb,
                true,
                1,
                $1
            )
        `, [tonyId]);

        console.log('   ✓ Created: Create client setup subtasks (execution_order: 1)');
        console.log('   Conditions: status=client-setup');
        console.log('   Actions: Create 2 subtasks (Security deposit + WMS Setup)');

        // Commit transaction
        await client.query('COMMIT');

        console.log('\n✅ Migration completed successfully!');
        console.log('');
        console.log('Default automations created:');
        console.log('  1. Auto-assign Ian to fulfillment ops (execution_order: 0)');
        console.log('  2. Auto-approve simple clients (execution_order: 1)');
        console.log('  3. Create client setup subtasks (execution_order: 1)');
        console.log('');
        console.log('These automations replicate the existing hard-coded behavior.');
        console.log('You can now manage them via the Automations tab in the app.');

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
