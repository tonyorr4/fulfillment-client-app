const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkTables() {
    try {
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log('Tables in database:');
        result.rows.forEach(row => {
            console.log(' -', row.table_name);
        });

        // Check if clients table exists
        const clientsCheck = result.rows.find(row => row.table_name === 'clients');
        if (clientsCheck) {
            // Check current columns in clients table
            const columns = await pool.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'clients'
                ORDER BY ordinal_position;
            `);
            console.log('\nColumns in clients table:');
            columns.rows.forEach(col => {
                console.log(` - ${col.column_name} (${col.data_type})`);
            });
        }

    } catch (error) {
        console.error('Error checking tables:', error);
    } finally {
        await pool.end();
    }
}

checkTables();
