# Setup: Connect to Shared Sincro Database

**Date:** October 30, 2025
**Purpose:** Connect Fulfillment Client App to shared Sincro OAuth ecosystem

---

## ✅ What's Been Done

1. **Updated authentication code** to use proper Sincro OAuth access control
2. **Updated ENVIRONMENT_VARIABLES.md** with shared database and OAuth credentials
3. **Updated OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md** to include Fulfillment app
4. **Fixed security vulnerability** where any Google user could auto-login

---

## 🔧 Required Actions

### 1. Add OAuth Redirect URI to Google Cloud Console

**You must do this manually:**

1. Go to https://console.cloud.google.com/apis/credentials
2. Select project: **Sincro Automation Apps**
3. Click on OAuth 2.0 Client ID: `867246022081-6cjf9qnldp5i9al9ji0cj54cue95nn9t`
4. Scroll to **"Authorized redirect URIs"**
5. Click **"+ ADD URI"**
6. Add this exact URI:
   ```
   https://fulfillment-client-app-production.up.railway.app/auth/google/callback
   ```
7. Click **"SAVE"**

**⚠️ The app will not work until you do this!**

---

### 2. Update Railway Environment Variables

In Railway dashboard → Your fulfillment app → Variables tab:

**Update these variables:**

Get the actual values from `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md`

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Change from separate Railway PostgreSQL to shared Sincro database URL |
| `GOOGLE_CLIENT_ID` | Update to shared Sincro OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Update to shared Sincro OAuth Client Secret |

**Add these if missing:**

| Variable | Value |
|----------|-------|
| `AUTO_ADMIN_EMAIL` | `tony.orr@easyship.com` |

**After updating:**
- Railway will automatically redeploy
- Wait for deployment to complete (green checkmark)

---

## 🎯 What This Achieves

### Before (Insecure):
- ❌ Anyone with a Google account could access the app
- ❌ No approval process
- ❌ Access requests not visible anywhere
- ❌ Isolated database

### After (Secure):
- ✅ Only `tony.orr@easyship.com` gets instant admin access
- ✅ All other users must request access
- ✅ Access requests appear in your Sincro Access App
- ✅ Centralized user management across all Sincro apps
- ✅ Users approved once can access all Sincro apps

---

## 🧪 Testing After Setup

### Test 1: Tony's Access (Should Work Instantly)
1. Go to https://fulfillment-client-app-production.up.railway.app
2. Sign in with `tony.orr@easyship.com`
3. Should get instant access to Kanban board ✅

### Test 2: Other User (Should Request Access)
1. Sign out and sign in with `sincro-reply@gosincro.com` (or any other email)
2. Should see access request form
3. Fill out department and reason
4. Submit request
5. Go to https://sincro-access-app-production.up.railway.app
6. Should see the access request in "Access Requests" tab ✅
7. Approve the user
8. User can now access the fulfillment app ✅

---

## 📊 Database Structure

The shared Sincro database now contains:

**Shared Tables (used by all Sincro apps):**
- `users` - All approved users across all apps
- `access_requests` - All access requests from all apps
- `audit_log` - Audit trail for all authentication events

**Fulfillment-Specific Tables:**
- `clients` - Fulfillment client requests
- `comments` - Comments on clients
- `subtasks` - Subtasks for clients
- `activity_log` - Activity log for client actions

All apps see the same users, but each app has its own business logic tables.

---

## 🚨 Important Notes

1. **Do NOT delete the old PostgreSQL service** in Railway until you've verified everything works
2. **The old database data will NOT be migrated automatically** - if you have important data, you'll need to export and import it
3. **Existing users in the old database** will need to be re-approved in the shared system
4. **Railway will auto-redeploy** when you change environment variables

---

## ✅ Verification Checklist

- [ ] Added OAuth redirect URI to Google Cloud Console
- [ ] Updated `DATABASE_URL` in Railway to shared Sincro database
- [ ] Updated `GOOGLE_CLIENT_ID` in Railway (if needed)
- [ ] Updated `GOOGLE_CLIENT_SECRET` in Railway (if needed)
- [ ] Added `AUTO_ADMIN_EMAIL` to Railway
- [ ] Waited for Railway deployment to complete
- [ ] Tested login with tony.orr@easyship.com (instant access)
- [ ] Tested login with another email (access request form shown)
- [ ] Submitted test access request
- [ ] Verified request appears in Sincro Access App
- [ ] Approved test user in Sincro Access App
- [ ] Verified approved user can now access fulfillment app

---

**Status:** Waiting for manual Railway configuration
**Next:** Update Railway variables and test
