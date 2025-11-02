/**
 * Verification Script: Automation System
 * Checks that all components are properly installed and configured
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: 'postgresql://postgres:UsXVgqVNrIcFFSwdHpoNSkGGdhKskaHr@metro.proxy.rlwy.net:49366/railway',
    ssl: { rejectUnauthorized: false }
});

async function verifySystem() {
    console.log('\n🔍 AUTOMATION SYSTEM VERIFICATION');
    console.log('='.repeat(70));

    let allChecks = true;

    try {
        // Check 1: Verify automations table exists
        console.log('\n1️⃣  Checking automations table...');
        const automationsTable = await pool.query(`
            SELECT COUNT(*) as count
            FROM information_schema.tables
            WHERE table_name = 'automations'
        `);
        if (automationsTable.rows[0].count === '1') {
            console.log('   ✅ automations table exists');
        } else {
            console.log('   ❌ automations table NOT FOUND');
            allChecks = false;
        }

        // Check 2: Verify automation_logs table exists
        console.log('\n2️⃣  Checking automation_logs table...');
        const logsTable = await pool.query(`
            SELECT COUNT(*) as count
            FROM information_schema.tables
            WHERE table_name = 'automation_logs'
        `);
        if (logsTable.rows[0].count === '1') {
            console.log('   ✅ automation_logs table exists');
        } else {
            console.log('   ❌ automation_logs table NOT FOUND');
            allChecks = false;
        }

        // Check 3: Verify indexes exist
        console.log('\n3️⃣  Checking indexes...');
        const indexes = await pool.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE tablename IN ('automations', 'automation_logs')
            ORDER BY indexname
        `);
        const expectedIndexes = [
            'idx_automations_order',
            'idx_automations_trigger',
            'idx_automation_logs_automation',
            'idx_automation_logs_client',
            'idx_automation_logs_created'
        ];
        const foundIndexes = indexes.rows.map(r => r.indexname);
        let indexesOk = true;
        expectedIndexes.forEach(idx => {
            if (foundIndexes.includes(idx)) {
                console.log(`   ✅ ${idx}`);
            } else {
                console.log(`   ❌ ${idx} NOT FOUND`);
                indexesOk = false;
            }
        });
        if (!indexesOk) allChecks = false;

        // Check 4: Count existing automations
        console.log('\n4️⃣  Checking default automations...');
        const automations = await pool.query(`
            SELECT id, name, trigger_event, enabled, execution_order
            FROM automations
            ORDER BY execution_order, id
        `);
        console.log(`   Found ${automations.rows.length} automations:\n`);
        automations.rows.forEach((auto, i) => {
            const status = auto.enabled ? '✅' : '⏸️ ';
            console.log(`   ${i + 1}. ${status} ${auto.name}`);
            console.log(`      Trigger: ${auto.trigger_event} | Order: ${auto.execution_order}`);
        });

        if (automations.rows.length === 0) {
            console.log('   ⚠️  No automations found. Run seed-default-automations.js');
        }

        // Check 5: Verify automation engine functions
        console.log('\n5️⃣  Checking automation engine...');
        try {
            const engine = require('./automation-engine.js');
            const requiredFunctions = [
                'evaluateSingleCondition',
                'evaluateConditions',
                'setClientField',
                'createSubtask',
                'executeActions',
                'logAutomationExecution',
                'triggerAutomations'
            ];
            let engineOk = true;
            requiredFunctions.forEach(fn => {
                if (typeof engine[fn] === 'function') {
                    console.log(`   ✅ ${fn}()`);
                } else {
                    console.log(`   ❌ ${fn}() NOT FOUND`);
                    engineOk = false;
                }
            });
            if (!engineOk) allChecks = false;
        } catch (error) {
            console.log('   ❌ automation-engine.js failed to load:', error.message);
            allChecks = false;
        }

        // Check 6: Verify server.js integration
        console.log('\n6️⃣  Checking server.js integration...');
        const fs = require('fs');
        const serverCode = fs.readFileSync('./server.js', 'utf8');

        const integrationPoints = [
            { name: 'Import triggerAutomations', pattern: /require\(['"]\.\/automation-engine/ },
            { name: 'GET /api/automations', pattern: /app\.get\(['"]\/api\/automations['"]/ },
            { name: 'POST /api/automations', pattern: /app\.post\(['"]\/api\/automations['"]/ },
            { name: 'Client creation trigger', pattern: /triggerAutomations.*client_created/ },
            { name: 'Status change trigger', pattern: /triggerAutomations.*status_changed/ }
        ];

        let integrationOk = true;
        integrationPoints.forEach(point => {
            if (point.pattern.test(serverCode)) {
                console.log(`   ✅ ${point.name}`);
            } else {
                console.log(`   ❌ ${point.name} NOT FOUND`);
                integrationOk = false;
            }
        });
        if (!integrationOk) allChecks = false;

        // Check 7: Check automation logs (if any executions happened)
        console.log('\n7️⃣  Checking automation execution logs...');
        const logs = await pool.query(`
            SELECT COUNT(*) as count
            FROM automation_logs
        `);
        console.log(`   📊 Total automation executions: ${logs.rows[0].count}`);

        if (parseInt(logs.rows[0].count) > 0) {
            const recentLogs = await pool.query(`
                SELECT al.*, a.name as automation_name, c.client_name
                FROM automation_logs al
                LEFT JOIN automations a ON al.automation_id = a.id
                LEFT JOIN clients c ON al.client_id = c.id
                ORDER BY al.created_at DESC
                LIMIT 5
            `);
            console.log('\n   Recent executions:');
            recentLogs.rows.forEach((log, i) => {
                const status = log.conditions_met ? '✅' : '⏭️ ';
                const time = new Date(log.created_at).toLocaleString();
                console.log(`   ${i + 1}. ${status} ${log.automation_name || `ID: ${log.automation_id}`}`);
                console.log(`      Client: ${log.client_name || `ID: ${log.client_id}`} | ${time}`);
                if (log.error_message) {
                    console.log(`      ❌ Error: ${log.error_message}`);
                }
            });
        }

        // Final summary
        console.log('\n' + '='.repeat(70));
        if (allChecks) {
            console.log('✅ VERIFICATION PASSED - Automation system is fully operational!\n');
            console.log('📋 Next Steps:');
            console.log('   1. Build frontend UI for automation management');
            console.log('   2. Add automation builder modal with condition/action editor');
            console.log('   3. Test creating/editing automations via UI');
            console.log('   4. Monitor automation_logs for successful executions\n');
            return true;
        } else {
            console.log('❌ VERIFICATION FAILED - Some components are missing or misconfigured\n');
            return false;
        }

    } catch (error) {
        console.error('\n❌ Verification failed with error:', error.message);
        console.error(error.stack);
        return false;
    } finally {
        await pool.end();
    }
}

// Run verification
verifySystem()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
