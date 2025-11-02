const { Pool } = require('pg');
require('dotenv').config();

// Use production database URL directly
const pool = new Pool({
    connectionString: 'postgresql://postgres:UsXVgqVNrIcFFSwdHpoNSkGGdhKskaHr@metro.proxy.rlwy.net:49366/railway',
    ssl: { rejectUnauthorized: false }
});

async function addCommentThreading() {
    try {
        console.log('Adding comment threading and edit functionality...\n');

        // Add parent_comment_id for threading (replies)
        console.log('1. Adding parent_comment_id column...');
        await pool.query(`
            ALTER TABLE comments
            ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE
        `);
        console.log('   ✅ parent_comment_id column added');

        // Add edited_at for tracking edits
        console.log('2. Adding edited_at column...');
        await pool.query(`
            ALTER TABLE comments
            ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP
        `);
        console.log('   ✅ edited_at column added');

        // Create index on parent_comment_id for faster queries
        console.log('3. Creating index on parent_comment_id...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id
            ON comments(parent_comment_id)
        `);
        console.log('   ✅ Index created');

        console.log('\n✅ Migration completed successfully!\n');
        console.log('Comments table now supports:');
        console.log('  - Threaded replies (parent_comment_id)');
        console.log('  - Edit tracking (edited_at)');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

addCommentThreading();
