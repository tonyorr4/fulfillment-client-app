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

## 🆘 Still Having Issues?

1. Check Railway logs for errors
2. Verify DATABASE_URL hostname is `metro.proxy.rlwy.net`
3. Verify OAuth redirect URI is added to Google Cloud Console
4. Read troubleshooting section in `SETUP-SHARED-SINCRO-DATABASE.md`

---

**Last Updated:** October 30, 2025
**Priority:** 🚨 CRITICAL - Complete before using the app
