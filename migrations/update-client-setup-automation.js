/**
 * Migration: Update client setup automation with trigger_on_enter_status
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

async function migrate() {
    try {
        console.log('🔧 Updating client setup automation...\n');

        // Update the client setup automation
        const result = await pool.query(`
            UPDATE automations
            SET trigger_on_enter = true,
                trigger_on_enter_status = 'client-setup'
            WHERE (name LIKE '%client setup%' OR name LIKE '%Client Setup%')
            AND trigger_event = 'status_changed'
            RETURNING id, name, trigger_on_enter, trigger_on_enter_status
        `);

        if (result.rows.length === 0) {
            console.log('⚠️  No client setup automation found to update.');
            console.log('   This might be normal if it was already updated or deleted.');
        } else {
            console.log('✅ Updated client setup automation:');
            result.rows.forEach(row => {
                console.log(`   - ID: ${row.id}`);
                console.log(`     Name: ${row.name}`);
                console.log(`     trigger_on_enter: ${row.trigger_on_enter}`);
                console.log(`     trigger_on_enter_status: ${row.trigger_on_enter_status}`);
            });
        }

        console.log('\n✅ Migration completed!');
        console.log('\n📋 What this means:');
        console.log('   • Automation will ONLY run when entering "client-setup" status');
        console.log('   • It will NOT run when editing a client already in "client-setup"');
        console.log('   • It will NOT run when entering other statuses');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

migrate()
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Failed:', error.message);
        process.exit(1);
    });
