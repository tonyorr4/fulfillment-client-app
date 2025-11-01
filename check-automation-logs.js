const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: 'postgresql://postgres:UsXVgqVNrIcFFSwdHpoNSkGGdhKskaHr@metro.proxy.rlwy.net:49366/railway',
    ssl: { rejectUnauthorized: false }
});

async function checkAutomationLogs() {
    try {
        console.log('Checking automation execution logs...\n');

        const result = await pool.query(`
            SELECT
                al.id,
                al.trigger_event,
                al.conditions_met,
                al.actions_executed,
                al.error_message,
                al.execution_time_ms,
                al.created_at,
                a.name as automation_name,
                c.client_name
            FROM automation_logs al
            LEFT JOIN automations a ON al.automation_id = a.id
            LEFT JOIN clients c ON al.client_id = c.id
            ORDER BY al.created_at DESC
            LIMIT 10
        `);

        if (result.rows.length === 0) {
            console.log('❌ No automation logs found yet.');
            console.log('   This means no automations have been triggered since deployment.\n');
            console.log('💡 To test automations, try:');
            console.log('   1. Create a new client (should trigger "Auto-assign Ian" and "Auto-approve")');
            console.log('   2. Change a client status to "client-setup" (should create subtasks)\n');
        } else {
            console.log(`✅ Found ${result.rows.length} recent automation executions:\n`);

            result.rows.forEach((log, i) => {
                console.log(`${i + 1}. ${log.automation_name || 'Unknown'}`);
                console.log(`   Client: ${log.client_name}`);
                console.log(`   Trigger: ${log.trigger_event}`);
                console.log(`   Conditions Met: ${log.conditions_met ? '✓ Yes' : '✗ No'}`);
                console.log(`   Execution Time: ${log.execution_time_ms}ms`);
                if (log.error_message) {
                    console.log(`   ❌ Error: ${log.error_message}`);
                }
                if (log.actions_executed) {
                    console.log(`   Actions: ${JSON.stringify(log.actions_executed, null, 2)}`);
                }
                console.log(`   Time: ${new Date(log.created_at).toLocaleString()}`);
                console.log('');
            });
        }

        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        await pool.end();
    }
}

checkAutomationLogs();
