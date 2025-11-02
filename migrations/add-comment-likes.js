const { Pool } = require('pg');
require('dotenv').config();

// Use production database URL directly
const pool = new Pool({
    connectionString: 'postgresql://postgres:UsXVgqVNrIcFFSwdHpoNSkGGdhKskaHr@metro.proxy.rlwy.net:49366/railway',
    ssl: { rejectUnauthorized: false }
});

async function addCommentLikes() {
    try {
        console.log('Adding comment likes table...\n');

        // Create comment_likes table
        console.log('1. Creating comment_likes table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS comment_likes (
                id SERIAL PRIMARY KEY,
                comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(comment_id, user_id)
            )
        `);
        console.log('   ✅ comment_likes table created');

        // Create indexes for faster queries
        console.log('2. Creating indexes...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id
            ON comment_likes(comment_id)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id
            ON comment_likes(user_id)
        `);
        console.log('   ✅ Indexes created');

        console.log('\n✅ Migration completed successfully!\n');
        console.log('Comments now support:');
        console.log('  - Like/unlike functionality');
        console.log('  - Unique constraint (one like per user per comment)');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

addCommentLikes();
