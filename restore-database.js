/**
 * Database Restore Script
 * Restores data from JSON backup files
 *
 * Usage: node restore-database.js [backup-file]
 * Example: node restore-database.js backups/backup_2025-11-03_12-30-00.json
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

async function restoreDatabase(backupFilePath) {
    console.log('Starting database restore...\n');

    // Read backup file
    if (!fs.existsSync(backupFilePath)) {
        throw new Error(`Backup file not found: ${backupFilePath}`);
    }

    console.log(`📁 Reading backup file: ${path.basename(backupFilePath)}`);
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));

    console.log(`📅 Backup date: ${backupData.metadata.backup_date}`);
    console.log(`📊 Backup type: ${backupData.metadata.backup_type}\n`);

    // Confirm restore
    console.log('⚠️  WARNING: This will restore data from backup.');
    console.log('   Existing records with matching IDs will be updated.\n');

    console.log('📊 Backup contains:');
    console.log(`   • ${backupData.statistics.total_clients} clients`);
    console.log(`   • ${backupData.statistics.total_comments} comments`);
    console.log(`   • ${backupData.statistics.total_subtasks} subtasks`);
    console.log(`   • ${backupData.statistics.total_activities} activities`);
    console.log(`   • ${backupData.statistics.total_likes} likes`);
    console.log(`   • ${backupData.statistics.total_attachments} attachments\n`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Note: We won't restore to users table as it's shared across all Sincro apps
        // Users are managed by Sincro Access app

        // Restore clients
        console.log('📦 Restoring clients...');
        for (const clientData of backupData.data.clients) {
            await client.query(`
                INSERT INTO clients (
                    id, client_id, client_name, client_email, est_inbound_date,
                    client_type, avg_orders, num_skus, battery, heavy_sku,
                    num_pallets, special_packaging, barcoding, additional_info,
                    status, client_approved, auto_approved, sales_team, fulfillment_ops,
                    created_by, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                ON CONFLICT (id) DO UPDATE SET
                    client_id = EXCLUDED.client_id,
                    client_name = EXCLUDED.client_name,
                    client_email = EXCLUDED.client_email,
                    est_inbound_date = EXCLUDED.est_inbound_date,
                    client_type = EXCLUDED.client_type,
                    avg_orders = EXCLUDED.avg_orders,
                    num_skus = EXCLUDED.num_skus,
                    battery = EXCLUDED.battery,
                    heavy_sku = EXCLUDED.heavy_sku,
                    num_pallets = EXCLUDED.num_pallets,
                    special_packaging = EXCLUDED.special_packaging,
                    barcoding = EXCLUDED.barcoding,
                    additional_info = EXCLUDED.additional_info,
                    status = EXCLUDED.status,
                    client_approved = EXCLUDED.client_approved,
                    auto_approved = EXCLUDED.auto_approved,
                    sales_team = EXCLUDED.sales_team,
                    fulfillment_ops = EXCLUDED.fulfillment_ops,
                    updated_at = EXCLUDED.updated_at
            `, [
                clientData.id, clientData.client_id, clientData.client_name,
                clientData.client_email, clientData.est_inbound_date,
                clientData.client_type, clientData.avg_orders, clientData.num_skus,
                clientData.battery, clientData.heavy_sku, clientData.num_pallets,
                clientData.special_packaging, clientData.barcoding, clientData.additional_info,
                clientData.status, clientData.client_approved, clientData.auto_approved,
                clientData.sales_team, clientData.fulfillment_ops, clientData.created_by,
                clientData.created_at, clientData.updated_at
            ]);
        }
        console.log(`   ✓ Restored ${backupData.data.clients.length} clients`);

        // Restore comments
        console.log('💬 Restoring comments...');
        for (const comment of backupData.data.comments) {
            await client.query(`
                INSERT INTO comments (
                    id, client_id, user_id, comment_text, mentioned_users,
                    parent_comment_id, edited_at, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                    comment_text = EXCLUDED.comment_text,
                    mentioned_users = EXCLUDED.mentioned_users,
                    edited_at = EXCLUDED.edited_at
            `, [
                comment.id, comment.client_id, comment.user_id, comment.comment_text,
                comment.mentioned_users, comment.parent_comment_id,
                comment.edited_at, comment.created_at
            ]);
        }
        console.log(`   ✓ Restored ${backupData.data.comments.length} comments`);

        // Restore subtasks
        console.log('✅ Restoring subtasks...');
        for (const subtask of backupData.data.subtasks) {
            await client.query(`
                INSERT INTO subtasks (
                    id, client_id, subtask_text, assignee, completed,
                    auto_created, created_at, completed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                    subtask_text = EXCLUDED.subtask_text,
                    assignee = EXCLUDED.assignee,
                    completed = EXCLUDED.completed,
                    completed_at = EXCLUDED.completed_at
            `, [
                subtask.id, subtask.client_id, subtask.subtask_text,
                subtask.assignee, subtask.completed, subtask.auto_created,
                subtask.created_at, subtask.completed_at
            ]);
        }
        console.log(`   ✓ Restored ${backupData.data.subtasks.length} subtasks`);

        // Restore activity log
        console.log('📝 Restoring activity log...');
        for (const activity of backupData.data.activities) {
            await client.query(`
                INSERT INTO activity_log (
                    id, client_id, user_id, action, details, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
            `, [
                activity.id, activity.client_id, activity.user_id,
                activity.action, activity.details, activity.created_at
            ]);
        }
        console.log(`   ✓ Restored ${backupData.data.activities.length} activities`);

        // Restore comment likes
        console.log('👍 Restoring comment likes...');
        for (const like of backupData.data.likes) {
            await client.query(`
                INSERT INTO comment_likes (id, comment_id, user_id, created_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO NOTHING
            `, [like.id, like.comment_id, like.user_id, like.created_at]);
        }
        console.log(`   ✓ Restored ${backupData.data.likes.length} likes`);

        // Restore attachments metadata
        console.log('📎 Restoring attachments metadata...');
        for (const attachment of backupData.data.attachments) {
            await client.query(`
                INSERT INTO attachments (
                    id, client_id, file_name, original_name, file_size,
                    file_type, file_path, uploaded_by, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET
                    file_name = EXCLUDED.file_name,
                    original_name = EXCLUDED.original_name,
                    file_size = EXCLUDED.file_size,
                    file_type = EXCLUDED.file_type,
                    file_path = EXCLUDED.file_path
            `, [
                attachment.id, attachment.client_id, attachment.file_name,
                attachment.original_name, attachment.file_size, attachment.file_type,
                attachment.file_path, attachment.uploaded_by, attachment.created_at
            ]);
        }
        console.log(`   ✓ Restored ${backupData.data.attachments.length} attachments`);

        // Update sequences to avoid ID conflicts
        console.log('\n🔢 Updating sequences...');
        await client.query(`SELECT setval('clients_id_seq', (SELECT MAX(id) FROM clients))`);
        await client.query(`SELECT setval('comments_id_seq', (SELECT MAX(id) FROM comments))`);
        await client.query(`SELECT setval('subtasks_id_seq', (SELECT MAX(id) FROM subtasks))`);
        await client.query(`SELECT setval('activity_log_id_seq', (SELECT MAX(id) FROM activity_log))`);
        await client.query(`SELECT setval('comment_likes_id_seq', (SELECT MAX(id) FROM comment_likes))`);
        await client.query(`SELECT setval('attachments_id_seq', (SELECT MAX(id) FROM attachments))`);
        console.log('   ✓ Sequences updated');

        await client.query('COMMIT');

        console.log('\n✅ Database restore completed successfully!');
        console.log(`   📊 Restored from: ${backupData.metadata.backup_date}`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Restore failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

// List available backups
function listBackups() {
    const backupDir = path.join(__dirname, 'backups');

    if (!fs.existsSync(backupDir)) {
        console.log('No backups directory found');
        return [];
    }

    const files = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('backup_') && file.endsWith('.json'))
        .map(file => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            return {
                filename: file,
                path: filePath,
                size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                modified: stats.mtime
            };
        })
        .sort((a, b) => b.modified - a.modified);

    return files;
}

// Run restore if called directly
if (require.main === module) {
    const backupFile = process.argv[2];

    if (!backupFile) {
        console.log('📋 Available backups:\n');
        const backups = listBackups();

        if (backups.length === 0) {
            console.log('   No backups found');
            console.log('\n💡 Create a backup first: node backup-database.js');
        } else {
            backups.forEach((backup, index) => {
                console.log(`   ${index + 1}. ${backup.filename}`);
                console.log(`      Size: ${backup.size}`);
                console.log(`      Date: ${backup.modified.toLocaleString()}`);
                console.log('');
            });

            console.log('Usage: node restore-database.js <backup-file>');
            console.log(`Example: node restore-database.js backups/${backups[0].filename}`);
        }
        process.exit(0);
    }

    restoreDatabase(backupFile)
        .then(() => {
            console.log('\n✓ Restore process completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Restore process failed:', error);
            process.exit(1);
        });
}

module.exports = { restoreDatabase, listBackups };
