# 🚨 RAILWAY SETUP CHECKLIST - READ THIS FIRST

**Before deploying or debugging: Complete these steps!**

---

## ⚠️ CRITICAL: This App Uses Shared Sincro Database

**DO NOT** create a separate PostgreSQL service in Railway!

This app shares the database with:
- Sincro Maintenance App
- Sincro Access App

---

## ✅ Railway Configuration Checklist

### Step 1: Update Environment Variables

Go to: Railway Dashboard → fulfillment-client-app → **Variables** tab

**Update these 3 variables** (get values from `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md`):

- [ ] `DATABASE_URL` → Shared Sincro database URL (starts with `metro.proxy.rlwy.net`)
- [ ] `GOOGLE_CLIENT_ID` → Shared Sincro OAuth Client ID
- [ ] `GOOGLE_CLIENT_SECRET` → Shared Sincro OAuth Client Secret

**Add if missing:**

- [ ] `AUTO_ADMIN_EMAIL` = `tony.orr@easyship.com`
- [ ] `NODE_ENV` = `production`
- [ ] `APP_URL` = `https://fulfillment-client-app-production.up.railway.app`
- [ ] `GOOGLE_CALLBACK_URL` = `https://fulfillment-client-app-production.up.railway.app/auth/google/callback`
- [ ] `SESSION_SECRET` = (random 32+ character string)

### Step 2: Add OAuth Redirect URI

Go to: https://console.cloud.google.com/apis/credentials

- [ ] Click OAuth 2.0 Client ID
- [ ] Add redirect URI: `https://fulfillment-client-app-production.up.railway.app/auth/google/callback`
- [ ] Click SAVE

### Step 3: Wait for Deployment

- [ ] Railway auto-deploys when you change variables
- [ ] Go to Deployments tab
- [ ] Wait for green checkmark
- [ ] Check logs: "Server running on port XXXX"

### Step 4: Test

- [ ] Visit: https://fulfillment-client-app-production.up.railway.app
- [ ] Sign in with `tony.orr@easyship.com` → Should get instant access
- [ ] Sign out and try with another email → Should see access request form
- [ ] Submit request → Should appear in Sincro Access App

---

## 🔍 Quick Database Check

**How to verify you're using the CORRECT database:**

1. Go to Railway → fulfillment-client-app → Variables
2. Check `DATABASE_URL` value
3. Look at hostname:
   - ✅ **CORRECT:** `metro.proxy.rlwy.net:49366`
   - ❌ **WRONG:** `maglev.proxy.rlwy.net:49885` (your own database)

If using wrong database:
- Access requests won't appear in Sincro Access App
- Users won't be centrally managed
- Single sign-on won't work

---

## 📚 Detailed Documentation

- **Full setup guide:** `SETUP-SHARED-SINCRO-DATABASE.md`
- **Environment variables:** `ENVIRONMENT_VARIABLES.md`
- **Sincro OAuth system:** `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md`

---

## 🆘 Common Errors

### Error: "column 'active' does not exist"

**Problem:** App trying to check for `active` column but shared database doesn't have it

**Root Cause:** The shared Sincro database was created by the maintenance app, which doesn't use an `active` column in the users table.

**Solution:** This has been fixed in the latest code. If you see this error:
1. Make sure your local code is up to date: `git pull`
2. Railway should auto-deploy the fix
3. If not, manually trigger a redeploy in Railway

**Already Fixed in Code:**
- auth-config.js now only checks `approved` column (not `active`)
- database.js users table matches shared Sincro schema

### Error: "getaddrinfo ENOTFOUND base"

**Problem:** DATABASE_URL is malformed or not set correctly

**Solution:**
1. Go to Railway → Variables tab
2. Check DATABASE_URL value
3. It should be the FULL connection string starting with `postgresql://`
4. **DO NOT** use Railway reference variables like `${{Postgres.DATABASE_URL}}`
5. **DO NOT** put placeholder text like "See OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md"
6. Copy the EXACT connection string from `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md`

**Example CORRECT format:**
```
postgresql://postgres:PASSWORD@metro.proxy.rlwy.net:49366/railway
```

**Example WRONG formats:**
```
❌ base
❌ ${{Postgres.DATABASE_URL}}
❌ See OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md
❌ postgresql://base
```

### Still Having Issues?

1. Check Railway logs for errors
2. Verify DATABASE_URL is the complete connection string
3. Verify DATABASE_URL hostname is `metro.proxy.rlwy.net`
4. Verify OAuth redirect URI is added to Google Cloud Console
5. Read troubleshooting section in `SETUP-SHARED-SINCRO-DATABASE.md`

---

**Last Updated:** October 30, 2025
**Priority:** 🚨 CRITICAL - Complete before using the app
