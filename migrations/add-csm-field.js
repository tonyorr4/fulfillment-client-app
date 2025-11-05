// Migration: Add CSM (Customer Success Manager) field to clients table
// This field is optional and allows tracking of CSM assignments per client

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addCsmField() {
    const client = await pool.connect();

    try {
        console.log('🔧 Starting migration: Add CSM field to clients table...');

        // Add csm column to clients table (nullable, not required)
        await client.query(`
            ALTER TABLE clients
            ADD COLUMN IF NOT EXISTS csm VARCHAR(255)
        `);

        console.log('✅ Migration completed: CSM field added successfully');
        console.log('   - Column: csm VARCHAR(255) NULL');
        console.log('   - Table: clients');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration
addCsmField()
    .then(() => {
        console.log('✓ Migration script finished');
        process.exit(0);
    })
    .catch((error) => {
        console.error('✗ Migration script failed:', error);
        process.exit(1);
    });
