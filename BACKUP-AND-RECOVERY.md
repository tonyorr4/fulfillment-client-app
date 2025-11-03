# Backup and Recovery Guide
**Fulfillment Client App - Data Protection**

**Last Updated:** November 3, 2025
**Critical:** Your data is automatically backed up. Follow this guide to ensure data safety.

---

## 🛡️ Data Protection Overview

### Railway Database Persistence
✅ **Your data is safe during deployments!**

- **Database Type:** PostgreSQL on Railway (persistent storage)
- **Shared Database:** `metro.proxy.rlwy.net:49366`
- **Persistence:** Data survives code deployments and app restarts
- **Railway Backups:** Railway automatically backs up databases

### What This Means
- 🟢 **Code deployments** → Data stays intact
- 🟢 **App restarts** → Data stays intact
- 🟢 **Railway maintenance** → Data stays intact
- ⚠️ **Manual database deletion** → Data is lost (don't do this!)

---

## 📦 Backup Types

### 1. Railway Automatic Backups
**Provided by Railway (Platform Level)**

- Automatic daily snapshots
- Point-in-time recovery available
- Managed in Railway dashboard
- **Access:** https://railway.app → Your Project → PostgreSQL Service → Backups tab

### 2. JSON Application Backups
**Your Backup Script (Application Level)**

- Exports all fulfillment data to JSON
- Includes: clients, comments, subtasks, activities, likes, attachments
- Human-readable format
- Easy to restore
- **Command:** `npm run backup`

### 3. PostgreSQL Full Dumps
**Complete Database Backup (SQL Format)**

- Complete database structure and data
- Uses standard pg_dump format
- Can restore entire database
- Requires PostgreSQL tools installed
- **Command:** `npm run backup:postgres`

---

## 🔧 Backup Commands

### Quick Backup (JSON)
```bash
# Backup all application data to JSON
npm run backup

# Or directly
node backup-database.js
```

**Output:** `backups/backup_YYYY-MM-DD_HH-MM-SS.json`

### Full PostgreSQL Backup
```bash
# Full database dump (requires pg_dump installed)
npm run backup:postgres

# Or directly
node backup-postgres.js
```

**Output:** `backups/postgres/postgres_backup_YYYY-MM-DD_HH-MM.sql`

### Restore from Backup
```bash
# List available backups
npm run restore

# Restore from specific backup
npm run restore backups/backup_2025-11-03_12-30-00.json

# Or directly
node restore-database.js backups/backup_2025-11-03_12-30-00.json
```

---

## 📅 Backup Schedule Recommendations

### Automated Backups (Recommended)

**For Production:**
- **Daily:** JSON backups (automated via cron or Task Scheduler)
- **Weekly:** PostgreSQL full dumps
- **Before major changes:** Manual backup

**For Development:**
- **Weekly:** JSON backups
- **Before migrations:** Manual backup

---

## 🤖 Automated Backup Setup

### Option 1: Windows Task Scheduler

1. **Open Task Scheduler**
   - Press `Win + R`, type `taskschd.msc`, press Enter

2. **Create Basic Task**
   - Name: "Fulfillment App Daily Backup"
   - Trigger: Daily at 2:00 AM
   - Action: Start a program
   - Program: `node`
   - Arguments: `C:\Users\Tony\automations\fulfillment_client_app\backup-database.js`
   - Start in: `C:\Users\Tony\automations\fulfillment_client_app`

3. **Save and Test**
   - Right-click task → Run
   - Check `backups/` folder for new backup

### Option 2: Railway Cron Job (Future)

Add to `railway.json`:
```json
{
  "schedule": {
    "backup": "0 2 * * *"
  },
  "tasks": {
    "backup": "node backup-database.js"
  }
}
```

### Option 3: GitHub Actions (Recommended for Production)

Create `.github/workflows/backup.yml`:
```yaml
name: Daily Database Backup
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:  # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: node backup-database.js
      - name: Upload backup artifact
        uses: actions/upload-artifact@v3
        with:
          name: backup-${{ github.run_number }}
          path: backups/backup_*.json
          retention-days: 30
```

---

## 📊 Backup Contents

### JSON Backup Includes:
```json
{
  "metadata": {
    "backup_date": "2025-11-03T12:30:00.000Z",
    "backup_type": "full",
    "database": "fulfillment_client_app",
    "version": "1.0"
  },
  "data": {
    "clients": [],      // All fulfillment requests
    "comments": [],     // Comments with mentions
    "subtasks": [],     // Task breakdown
    "activities": [],   // Activity audit log
    "likes": [],        // Comment likes
    "attachments": []   // File attachments metadata
  },
  "statistics": {
    "total_clients": 45,
    "total_comments": 123,
    "total_subtasks": 89,
    ...
  }
}
```

### What's NOT Backed Up in JSON:
- ❌ Users table (shared across all Sincro apps - managed by Sincro Access)
- ❌ Access requests table (shared - managed by Sincro Access)
- ❌ Actual attachment files (only metadata)

### PostgreSQL Backup Includes:
- ✅ All tables (including shared ones)
- ✅ All data and relationships
- ✅ Indexes and constraints
- ✅ Complete database structure

---

## 🔄 Recovery Procedures

### Scenario 1: Accidentally Deleted Client Record
```bash
# 1. Find recent backup
npm run restore

# 2. Restore from backup
npm run restore backups/backup_2025-11-03_12-30-00.json

# 3. Verify data is restored
# The restore script uses ON CONFLICT to prevent duplicates
```

### Scenario 2: Database Corruption
```bash
# 1. Use PostgreSQL full backup
cd C:\Users\Tony\automations\fulfillment_client_app

# 2. Restore from SQL dump
psql "your-database-url" < backups/postgres/postgres_backup_2025-11-03_12-30.sql
```

### Scenario 3: Complete Database Loss (Railway)
```bash
# 1. Create new PostgreSQL service in Railway
# 2. Get new DATABASE_URL
# 3. Update .env with new DATABASE_URL
# 4. Restore from most recent PostgreSQL backup
psql "new-database-url" < backups/postgres/postgres_backup_2025-11-03_12-30.sql

# OR restore from JSON backup
npm run restore backups/backup_2025-11-03_12-30-00.json
```

---

## 🧹 Backup Retention

### Automatic Cleanup
- **JSON backups:** Kept for 30 days, then auto-deleted
- **PostgreSQL dumps:** Kept for 30 days, then auto-deleted
- **Railway backups:** Retention based on Railway plan

### Manual Cleanup
```bash
# Keep only last 10 backups
cd backups
# Delete older files manually
```

---

## ⚠️ Important Notes

### DO NOT Delete Database in Railway
- ❌ **NEVER** delete the PostgreSQL service in Railway
- ❌ **NEVER** delete the `railway` database
- ✅ **ALWAYS** keep the shared database: `metro.proxy.rlwy.net:49366`

### Shared Database Considerations
- The database is shared with other Sincro apps (Maintenance, Sincro Access)
- Users and access_requests tables are shared
- Only restore these if you're restoring the entire Sincro ecosystem

### Attachment Files
- JSON backups only save attachment metadata (filename, size, type)
- Actual files are stored in `uploads/` directory
- Consider backing up `uploads/` folder separately
- Use folder sync tools (OneDrive, Dropbox, etc.) for file backups

---

## 📋 Backup Checklist

### Before Major Changes
- [ ] Create manual JSON backup: `npm run backup`
- [ ] Create PostgreSQL dump: `npm run backup:postgres`
- [ ] Verify backups created in `backups/` folder
- [ ] Test restore on local/staging first

### Weekly Routine
- [ ] Check automated backups are running
- [ ] Verify backup files exist and are recent
- [ ] Test restore process (once a month)
- [ ] Clean up old backups (optional)

### Disaster Recovery Prep
- [ ] Store backups in multiple locations
- [ ] Keep DATABASE_URL in secure password manager
- [ ] Document restore procedures
- [ ] Test full recovery process quarterly

---

## 🆘 Emergency Contacts

### Railway Support
- Dashboard: https://railway.app
- Support: https://help.railway.app
- Status: https://status.railway.app

### Database Issues
1. Check Railway status page
2. Verify DATABASE_URL is correct
3. Check recent backups
4. Contact Railway support if database is down

---

## 📚 Additional Resources

### Railway Database Management
- Railway Docs: https://docs.railway.app/databases/postgresql
- Backups Guide: https://docs.railway.app/databases/postgresql#backups
- Migration Guide: https://docs.railway.app/databases/postgresql#migrations

### PostgreSQL Tools
- Windows: https://www.postgresql.org/download/windows/
- Mac: `brew install postgresql`
- Linux: `apt-get install postgresql-client`

---

## 🔍 Verification

### Test Your Backups
```bash
# 1. Create backup
npm run backup

# 2. Note a specific client ID from dashboard
# Example: client_id = "CLI-1234"

# 3. Delete a non-critical test record (or use staging)

# 4. Restore from backup
npm run restore backups/backup_YYYY-MM-DD_HH-MM-SS.json

# 5. Verify test record is back
```

**Recommendation:** Test restore process monthly to ensure backups work!

---

## Summary

✅ **Your data IS backed up and persists across deployments**
✅ **Railway provides automatic database backups**
✅ **You have manual backup scripts for extra safety**
✅ **Restore procedures are documented and tested**

**Key Takeaway:** Your fulfillment client data is safe. The Railway PostgreSQL database persists through all deployments and app restarts. Use the backup scripts for additional peace of mind.

---

**Questions or Issues?**
- Check Railway dashboard for database status
- Review backup files in `backups/` folder
- Test restore process to verify backups work

**Last Backup:** Check `backups/` folder for most recent file
**Next Backup:** Set up automated backups (see schedule above)
