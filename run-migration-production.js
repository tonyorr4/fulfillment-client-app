/**
 * Run migration directly on production database
 * This adds the created_by column to subtasks table
 */

const { Pool } = require('pg');
require('dotenv').config();

async function runMigration() {
    console.log('🚀 Connecting to production database...\n');

    // Show which database we're connecting to (hide password)
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('❌ ERROR: DATABASE_URL not found in .env file');
        console.error('Please make sure DATABASE_URL is set to your production database URL');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('railway.app') || dbUrl.includes('amazonaws.com') ? { rejectUnauthorized: false } : false
    });

    try {
        // Check if column already exists
        const checkResult = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'subtasks'
            AND column_name = 'created_by'
        `);

        if (checkResult.rows.length > 0) {
            console.log('✅ Column created_by already exists in subtasks table.');
            console.log('✅ Migration already complete - nothing to do!\n');
            return;
        }

        console.log('📋 Adding created_by column to subtasks table...');

        // Add the column
        await pool.query(`
            ALTER TABLE subtasks
            ADD COLUMN created_by INTEGER REFERENCES users(id)
        `);

        console.log('✅ Column added successfully!');

        // Create index
        console.log('📋 Creating index on created_by...');
        await pool.query(`
            CREATE INDEX idx_subtasks_created_by ON subtasks(created_by)
        `);

        console.log('✅ Index created successfully!');

        // Verify
        const verifyResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'subtasks'
            AND column_name = 'created_by'
        `);

        console.log('\n✅ Migration completed successfully!');
        console.log('Verification:', verifyResult.rows[0]);
        console.log('\n✅ Open Subtasks report should now work!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Full error:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration()
    .then(() => {
        console.log('\n🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Failed!');
        process.exit(1);
    });
