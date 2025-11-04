/**
 * Migration: Add created_by column to subtasks table
 * This allows tracking which user created each subtask
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('🔧 Starting migration: Add created_by to subtasks table...\n');

        // Check if column already exists
        const checkColumn = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'subtasks'
            AND column_name = 'created_by'
        `);

        if (checkColumn.rows.length > 0) {
            console.log('✅ Column created_by already exists in subtasks table.');
            return;
        }

        // Add created_by column
        await client.query(`
            ALTER TABLE subtasks
            ADD COLUMN created_by INTEGER REFERENCES users(id)
        `);

        console.log('✅ Added created_by column to subtasks table');

        // Create index for better performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_subtasks_created_by
            ON subtasks(created_by)
        `);

        console.log('✅ Created index on created_by column');

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate()
    .then(() => {
        console.log('\n🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Migration failed with error:', error.message);
        process.exit(1);
    });
