/**
 * PostgreSQL Database Backup Script (Full Database Dump)
 * Creates a complete PostgreSQL dump using pg_dump
 *
 * Usage: node backup-postgres.js
 *
 * Note: Requires pg_dump to be installed and accessible in PATH
 * Download PostgreSQL tools: https://www.postgresql.org/download/
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Backup directory
const BACKUP_DIR = path.join(__dirname, 'backups', 'postgres');

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('✓ Created postgres backups directory');
}

// Format date for backup filename
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}`;
}

async function backupPostgres() {
    console.log('Starting PostgreSQL full backup...\n');

    const backupTimestamp = new Date();
    const backupFilename = `postgres_backup_${formatDate(backupTimestamp)}.sql`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ ERROR: DATABASE_URL not found in environment variables');
        console.error('   Make sure .env file exists and contains DATABASE_URL');
        process.exit(1);
    }

    console.log('📦 Database: Railway PostgreSQL');
    console.log(`📁 Backup file: ${backupFilename}\n`);

    return new Promise((resolve, reject) => {
        // Use pg_dump to create backup
        // --no-owner: Don't output ownership commands
        // --no-acl: Don't output access control commands (GRANT/REVOKE)
        // --clean: Add DROP statements before CREATE statements
        // --if-exists: Use IF EXISTS when dropping objects
        const command = `pg_dump "${databaseUrl}" --no-owner --no-acl --clean --if-exists > "${backupPath}"`;

        console.log('⏳ Creating database dump...');
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Backup failed:', error.message);

                if (error.message.includes('pg_dump')) {
                    console.error('\n⚠️  pg_dump not found. Please install PostgreSQL tools:');
                    console.error('   Windows: https://www.postgresql.org/download/windows/');
                    console.error('   Mac: brew install postgresql');
                    console.error('   Linux: apt-get install postgresql-client');
                }

                reject(error);
                return;
            }

            if (stderr) {
                console.log('   ⚠️  Warnings:', stderr);
            }

            // Check if file was created
            if (fs.existsSync(backupPath)) {
                const fileSizeMB = (fs.statSync(backupPath).size / (1024 * 1024)).toFixed(2);
                console.log('\n✅ PostgreSQL backup completed successfully!');
                console.log(`   📁 File: ${backupFilename}`);
                console.log(`   💾 Size: ${fileSizeMB} MB`);
                console.log(`   📍 Location: ${backupPath}`);
                console.log('\n📋 Backup includes:');
                console.log('   • All tables (clients, comments, subtasks, etc.)');
                console.log('   • All data and relationships');
                console.log('   • Indexes and constraints');
                console.log('   • Ready for full database restore');

                // Clean up old backups
                cleanOldBackups(30);

                resolve({ success: true, backupPath, filename: backupFilename });
            } else {
                reject(new Error('Backup file was not created'));
            }
        });
    });
}

function cleanOldBackups(daysToKeep = 30) {
    console.log(`\n🧹 Cleaning up backups older than ${daysToKeep} days...`);

    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const now = Date.now();
        const cutoffTime = daysToKeep * 24 * 60 * 60 * 1000;

        let deletedCount = 0;

        files.forEach(file => {
            if (file.startsWith('postgres_backup_') && file.endsWith('.sql')) {
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
    backupPostgres()
        .then(() => {
            console.log('\n✓ PostgreSQL backup process completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ PostgreSQL backup process failed');
            process.exit(1);
        });
}

module.exports = { backupPostgres, cleanOldBackups };
