/**
 * Check current automation configuration
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

async function checkConfig() {
    try {
        console.log('🔍 Checking client setup automation configuration...\n');

        const result = await pool.query(`
            SELECT
                id,
                name,
                trigger_event,
                trigger_on_enter,
                trigger_on_enter_status,
                enabled,
                execution_order,
                conditions,
                actions
            FROM automations
            WHERE (name LIKE '%client setup%' OR name LIKE '%Client Setup%')
            ORDER BY id
        `);

        if (result.rows.length === 0) {
            console.log('❌ No client setup automation found!');
            return;
        }

        result.rows.forEach(automation => {
            console.log('📋 Automation Details:');
            console.log(`   ID: ${automation.id}`);
            console.log(`   Name: ${automation.name}`);
            console.log(`   Trigger Event: ${automation.trigger_event}`);
            console.log(`   Enabled: ${automation.enabled}`);
            console.log(`   Execution Order: ${automation.execution_order}`);
            console.log(`\n   🎯 TRIGGER SETTINGS:`);
            console.log(`   trigger_on_enter: ${automation.trigger_on_enter}`);
            console.log(`   trigger_on_enter_status: ${automation.trigger_on_enter_status || 'NULL (not set!)'}`);
            console.log(`\n   📝 Conditions:`, JSON.stringify(automation.conditions, null, 2));
            console.log(`\n   ⚡ Actions:`, JSON.stringify(automation.actions, null, 2));
            console.log('\n' + '='.repeat(80) + '\n');
        });

        // Check if settings are correct
        const automation = result.rows[0];
        console.log('✅ Configuration Check:\n');

        if (automation.trigger_on_enter === true) {
            console.log('   ✅ trigger_on_enter is TRUE (good!)');
        } else {
            console.log('   ❌ trigger_on_enter is FALSE or NULL - should be TRUE!');
        }

        if (automation.trigger_on_enter_status === 'client-setup') {
            console.log('   ✅ trigger_on_enter_status is "client-setup" (good!)');
        } else {
            console.log(`   ❌ trigger_on_enter_status is "${automation.trigger_on_enter_status}" - should be "client-setup"!`);
        }

        if (automation.trigger_event === 'status_changed') {
            console.log('   ✅ trigger_event is "status_changed" (good!)');
        } else {
            console.log(`   ❌ trigger_event is "${automation.trigger_event}" - should be "status_changed"!`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

checkConfig()
    .then(() => {
        console.log('\n✅ Check completed.');
        process.exit(0);
    })
    .catch(() => {
        process.exit(1);
    });
