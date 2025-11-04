/**
 * Check if Ian auto-assignment automation exists
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkAutomation() {
    try {
        console.log('Checking for Ian auto-assignment automation...\n');

        // Check if automations table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'automations'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('❌ Automations table does not exist.');
            console.log('   Run: node migrations/add-automation-system.js');
            return;
        }

        // Check for Ian automation
        const result = await pool.query(`
            SELECT id, name, description, trigger_event, conditions, actions, enabled, execution_order
            FROM automations
            WHERE name = 'Auto-assign Ian to fulfillment ops'
            ORDER BY id
        `);

        if (result.rows.length === 0) {
            console.log('❌ Ian auto-assignment automation NOT FOUND');
            console.log('');
            console.log('To create it, run:');
            console.log('   node migrations/seed-default-automations.js');
            console.log('');
            console.log('Or create it manually in the Automations tab of the app.');
        } else {
            console.log('✅ Ian auto-assignment automation EXISTS');
            console.log('');
            const automation = result.rows[0];
            console.log('Details:');
            console.log(`  ID: ${automation.id}`);
            console.log(`  Name: ${automation.name}`);
            console.log(`  Description: ${automation.description}`);
            console.log(`  Trigger: ${automation.trigger_event}`);
            console.log(`  Enabled: ${automation.enabled ? 'YES' : 'NO'}`);
            console.log(`  Execution Order: ${automation.execution_order}`);
            console.log(`  Conditions: ${JSON.stringify(automation.conditions, null, 2)}`);
            console.log(`  Actions: ${JSON.stringify(automation.actions, null, 2)}`);
            console.log('');

            if (!automation.enabled) {
                console.log('⚠️  WARNING: Automation is DISABLED');
                console.log('   Enable it in the Automations tab to make it work.');
            } else {
                console.log('✅ Automation is ENABLED and will run on new client creation');
            }
        }

        // Show all automations
        const allAutomations = await pool.query(`
            SELECT id, name, trigger_event, enabled, execution_order
            FROM automations
            ORDER BY execution_order, id
        `);

        console.log('\n' + '='.repeat(60));
        console.log('All Automations:');
        console.log('='.repeat(60));
        if (allAutomations.rows.length === 0) {
            console.log('No automations found.');
        } else {
            allAutomations.rows.forEach((auto) => {
                const status = auto.enabled ? '✅' : '❌';
                console.log(`${status} [${auto.execution_order}] ${auto.name} (${auto.trigger_event})`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

checkAutomation()
    .then(() => {
        console.log('\nCheck completed.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Check failed:', error);
        process.exit(1);
    });
