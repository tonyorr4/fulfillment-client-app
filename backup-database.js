/**
 * Automated Database Backup Script
 * Backs up all fulfillment client data to JSON files
 *
 * Usage: node backup-database.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

// Backup directory
const BACKUP_DIR = path.join(__dirname, 'backups');

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('✓ Created backups directory');
}

// Format date for backup filename
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

async function backupDatabase() {
    console.log('Starting database backup...\n');
    const backupTimestamp = new Date();
    const backupFilename = `backup_${formatDate(backupTimestamp)}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    try {
        // Backup all clients with related data
        console.log('📦 Backing up clients...');
        const clientsResult = await pool.query(`
            SELECT c.*, u.name as created_by_name, u.email as created_by_email
            FROM clients c
            LEFT JOIN users u ON c.created_by = u.id
            ORDER BY c.created_at DESC
        `);
        const clients = clientsResult.rows;
        console.log(`   ✓ ${clients.length} clients`);

        // Backup comments
        console.log('💬 Backing up comments...');
        const commentsResult = await pool.query(`
            SELECT c.*, u.name as user_name, u.email as user_email
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            ORDER BY c.created_at ASC
        `);
        const comments = commentsResult.rows;
        console.log(`   ✓ ${comments.length} comments`);

        // Backup subtasks
        console.log('✅ Backing up subtasks...');
        const subtasksResult = await pool.query(`
            SELECT * FROM subtasks
            ORDER BY created_at ASC
        `);
        const subtasks = subtasksResult.rows;
        console.log(`   ✓ ${subtasks.length} subtasks`);

        // Backup activity log
        console.log('📝 Backing up activity log...');
        const activityResult = await pool.query(`
            SELECT al.*, u.name as user_name, u.email as user_email
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
        `);
        const activities = activityResult.rows;
        console.log(`   ✓ ${activities.length} activities`);

        // Backup comment likes
        console.log('👍 Backing up comment likes...');
        const likesResult = await pool.query(`
            SELECT cl.*, u.name as user_name, u.email as user_email
            FROM comment_likes cl
            LEFT JOIN users u ON cl.user_id = u.id
            ORDER BY cl.created_at ASC
        `);
        const likes = likesResult.rows;
        console.log(`   ✓ ${likes.length} likes`);

        // Backup attachments metadata
        console.log('📎 Backing up attachments metadata...');
        const attachmentsResult = await pool.query(`
            SELECT a.*, u.name as uploaded_by_name, u.email as uploaded_by_email
            FROM attachments a
            LEFT JOIN users u ON a.uploaded_by = u.id
            ORDER BY a.created_at DESC
        `);
        const attachments = attachmentsResult.rows;
        console.log(`   ✓ ${attachments.length} attachments`);

        // Create backup object
        const backup = {
            metadata: {
                backup_date: backupTimestamp.toISOString(),
                backup_type: 'full',
                database: 'fulfillment_client_app',
                version: '1.0',
                tables_backed_up: ['clients', 'comments', 'subtasks', 'activity_log', 'comment_likes', 'attachments']
            },
            data: {
                clients,
                comments,
                subtasks,
                activities,
                likes,
                attachments
            },
            statistics: {
                total_clients: clients.length,
                total_comments: comments.length,
                total_subtasks: subtasks.length,
                total_activities: activities.length,
                total_likes: likes.length,
                total_attachments: attachments.length
            }
        };

        // Write backup to file
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');

        const fileSizeMB = (fs.statSync(backupPath).size / (1024 * 1024)).toFixed(2);
        console.log(`\n✅ Backup completed successfully!`);
        console.log(`   📁 File: ${backupFilename}`);
        console.log(`   💾 Size: ${fileSizeMB} MB`);
        console.log(`   📍 Location: ${backupPath}`);

        // Clean up old backups (keep last 30 days)
        cleanOldBackups(30);

        return { success: true, backupPath, backup };

    } catch (error) {
        console.error('❌ Backup failed:', error);
        throw error;
    }
}

function cleanOldBackups(daysToKeep = 30) {
    console.log(`\n🧹 Cleaning up backups older than ${daysToKeep} days...`);

    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const now = Date.now();
        const cutoffTime = daysToKeep * 24 * 60 * 60 * 1000; // Convert days to milliseconds

        let deletedCount = 0;

        files.forEach(file => {
            if (file.startsWith('backup_') && file.endsWith('.json')) {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                const fileAge = now - stats.mtimeMs;

                if (fileAge > cutoffTime) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    console.log(`   🗑️  Deleted old backup: ${file}`);
                }
            }
        });

        if (deletedCount === 0) {
            console.log('   ✓ No old backups to delete');
        } else {
            console.log(`   ✓ Deleted ${deletedCount} old backup(s)`);
        }
    } catch (error) {
        console.error('⚠️  Error cleaning old backups:', error.message);
    }
}

// Run backup if called directly
if (require.main === module) {
    backupDatabase()
        .then(() => {
            console.log('\n✓ Backup process completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Backup process failed:', error);
            process.exit(1);
        });
}

module.exports = { backupDatabase, cleanOldBackups };
