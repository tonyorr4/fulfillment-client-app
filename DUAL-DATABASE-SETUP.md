# Dual Database Setup - Fulfillment Client App

**Date:** November 4, 2025
**Status:** ✅ CODE UPDATED - Railway configuration needed

---

## What Changed

The fulfillment_client_app now uses the **DUAL DATABASE pattern** to match your attendance_app setup.

### Why This Change?

The fulfillment app has **existing production data** (clients, comments, subtasks, attachments) that must be kept separate from the shared Sincro authentication database.

### The Two Databases

```bash
# Database 1: Fulfillment Production Data
DATABASE_URL = Your fulfillment app's Railway PostgreSQL
  - Tables: clients, comments, subtasks, attachments, activity_log
  - Used by: database.js, server.js
  - Purpose: Store fulfillment-specific data

# Database 2: Shared Sincro Authentication
AUTH_DATABASE_URL = Shared Sincro Access database
  - Tables: users, access_requests, user_app_access, apps, audit_log
  - Used by: auth-config.js
  - Purpose: User authentication and access control
```

---

## ✅ What's Already Done (Code)

1. ✅ Updated `auth-config.js` to use AUTH_DATABASE_URL for user queries
2. ✅ Added `setDatabasePool()` function for compatibility
3. ✅ Added console logging to show which database is being used
4. ✅ Kept `database.js` unchanged (still uses DATABASE_URL for app data)

---

## 🚨 REQUIRED: Railway Environment Variables

You MUST update Railway environment variables for this to work!

### Step 1: Find Your Fulfillment Database URL

**Go to Railway Dashboard:**
1. Navigate to your fulfillment-client-app service
2. Click on the **PostgreSQL** plugin (if attached)
3. Click **"Variables"** tab
4. Find the value of `DATABASE_URL`
5. **Copy this value** - you'll need it!

**Example format:**
```
postgresql://postgres:ABC123xyz...@maglev.proxy.rlwy.net:49885/railway
```

### Step 2: Get Shared Sincro Auth Database URL

**Location:** `C:\Users\Tony\automations\docs\archive\oauth\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md`

**Look for the Sincro Access database connection string:**
```
postgresql://postgres:UsXVgqVN...@metro.proxy.rlwy.net:49366/railway
```

**Key identifier:** Hostname should be `metro.proxy.rlwy.net:49366`

### Step 3: Update Railway Variables

**Go to Railway Dashboard → fulfillment-client-app → Variables tab**

**Update these variables:**

| Variable Name | Current Value (WRONG) | New Value (CORRECT) | Purpose |
|---------------|----------------------|---------------------|---------|
| `DATABASE_URL` | May be pointing to Sincro DB | **YOUR fulfillment PostgreSQL URL** (from Step 1) | App data (clients, comments) |
| `AUTH_DATABASE_URL` | Not set | **Sincro Access DB URL** (from Step 2) | User authentication |

**Example:**

```bash
# BEFORE (Wrong - everything in one database)
DATABASE_URL=postgresql://postgres:UsXVgqVN...@metro.proxy.rlwy.net:49366/railway

# AFTER (Correct - dual database)
DATABASE_URL=postgresql://postgres:ABC123xyz...@maglev.proxy.rlwy.net:49885/railway
AUTH_DATABASE_URL=postgresql://postgres:UsXVgqVN...@metro.proxy.rlwy.net:49366/railway
```

### Step 4: Wait for Redeployment

After saving environment variables:
1. Railway will **automatically redeploy** (1-2 minutes)
2. Go to **"Deployments"** tab
3. Wait for green checkmark ✅
4. Check logs for: `✓ Using separate AUTH database for OAuth`

---

## 🧪 Testing After Deployment

### Test 1: Tony's Login (Auto-Approve)
1. Go to fulfillment app URL
2. Sign in with `tony.orr@easyship.com`
3. Should get instant access ✅

### Test 2: Ian's Login (Already Approved)
1. Sign in with `ian@gosincro.com`
2. **Should now work!** ✅
3. He was already approved and granted access to fulfillment_client_app (user_id: 15, app_id: 5)

### Test 3: New User (Access Request)
1. Sign in with a new email
2. Should see access request form
3. Fill out and submit
4. **Check Sincro Access app** - request should appear there ✅

---

## 🔍 Verification Checklist

After Railway redeploys, check the logs for:

```bash
# Should see this in Railway logs:
✓ Using separate AUTH database for OAuth (users, access_requests)
  AUTH_DATABASE_URL: postgresql://postgres:UsXVgqVN...

# Should NOT see:
⚠ AUTH_DATABASE_URL not set - using DATABASE_URL for both app and auth data
```

**If you see the warning ⚠️:** AUTH_DATABASE_URL is not set in Railway variables!

---

## 📊 Database Table Locations

After this setup:

### DATABASE_URL (Fulfillment PostgreSQL)
- `clients` ✅
- `comments` ✅
- `subtasks` ✅
- `attachments` ✅
- `activity_log` ✅

### AUTH_DATABASE_URL (Shared Sincro)
- `users` ✅ (Shared across all Sincro apps)
- `access_requests` ✅ (Visible in Sincro Access app)
- `user_app_access` ✅ (Per-app permissions)
- `apps` ✅ (App registry)
- `audit_log` ✅ (Authentication events)

---

## 🚨 Important Notes

1. **DO NOT delete your fulfillment PostgreSQL service** - it contains all your client data!
2. **Both databases are required** - the app won't work without AUTH_DATABASE_URL
3. **Ian should be able to log in** immediately after Railway redeploys
4. **All new access requests** will appear in Sincro Access app
5. **Users approved once** can access all Sincro apps (maintenance, attendance, fulfillment)

---

## 🔧 Troubleshooting

### Problem: "Ian still can't log in"
**Check:**
1. Railway has redeployed successfully (green checkmark)
2. Railway logs show: `✓ Using separate AUTH database for OAuth`
3. AUTH_DATABASE_URL is set and points to `metro.proxy.rlwy.net:49366`

**Fix:** Verify Ian's access in database:
```bash
# In sincro_access directory
node -e "const { Pool } = require('pg'); require('dotenv').config(); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); (async () => { const result = await pool.query('SELECT * FROM user_app_access WHERE user_id = 15 AND app_id = 5'); console.log(result.rows); await pool.end(); })();"
```
Should show Ian has access to app_id: 5 (fulfillment_client_app)

### Problem: "Can't find fulfillment DATABASE_URL"
**Solution:** Your fulfillment app might be using the shared Sincro database for everything. Check Railway:
- If there's NO separate PostgreSQL service attached, you may need to create one
- OR migrate your fulfillment data to a new PostgreSQL instance
- Contact if you need help migrating data

### Problem: "Lost all my client data"
**Don't panic!** The data is still there. Check:
1. What is DATABASE_URL currently pointing to?
2. Your data is wherever that URL points
3. If you changed DATABASE_URL, change it back to restore access

---

## 📝 Summary

✅ **Code updated** to use dual database pattern
⚠️ **Railway configuration required** (add AUTH_DATABASE_URL)
🎯 **Expected result:** Ian and all approved users can log in
🔄 **Matches:** attendance_app setup (proven working pattern)

---

**Next Step:** Update Railway environment variables and wait for redeployment!

**Need Help?** Check Railway logs after deployment for any errors.
