/**
 * Check what tables exist in the connected database
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

async function checkTables() {
    try {
        console.log('🔍 Checking database connection...\n');

        // Show which database we're connected to (hide password)
        const dbUrl = process.env.DATABASE_URL;
        if (dbUrl) {
            const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
            console.log('Connected to:', maskedUrl, '\n');
        } else {
            console.log('❌ No DATABASE_URL found in environment\n');
            process.exit(1);
        }

        // List all tables
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('📋 Tables in database:\n');
        if (result.rows.length === 0) {
            console.log('   (no tables found)');
        } else {
            result.rows.forEach(row => {
                console.log(`   ✓ ${row.table_name}`);
            });
        }

        console.log('\n');

        // Check for specific tables we need
        const requiredTables = ['clients', 'users', 'subtasks', 'automations'];
        console.log('🔍 Checking required tables:\n');

        for (const tableName of requiredTables) {
            const exists = result.rows.some(row => row.table_name === tableName);
            if (exists) {
                console.log(`   ✅ ${tableName} - EXISTS`);
            } else {
                console.log(`   ❌ ${tableName} - MISSING`);
            }
        }

        console.log('\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

checkTables()
    .then(() => {
        console.log('✅ Check completed.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Check failed.');
        process.exit(1);
    });
