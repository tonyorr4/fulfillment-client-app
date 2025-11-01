const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: 'postgresql://postgres:UsXVgqVNrIcFFSwdHpoNSkGGdhKskaHr@metro.proxy.rlwy.net:49366/railway',
    ssl: { rejectUnauthorized: false }
});

async function checkAutomations() {
    try {
        console.log('Checking automations in database...\n');

        const result = await pool.query('SELECT * FROM automations ORDER BY execution_order');

        console.log(`Found ${result.rows.length} automations:\n`);

        result.rows.forEach((auto, i) => {
            console.log(`${i + 1}. ${auto.name}`);
            console.log(`   Enabled: ${auto.enabled}`);
            console.log(`   Trigger: ${auto.trigger_event}`);
            console.log(`   Order: ${auto.execution_order}`);
            console.log('');
        });

        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        await pool.end();
    }
}

checkAutomations();
