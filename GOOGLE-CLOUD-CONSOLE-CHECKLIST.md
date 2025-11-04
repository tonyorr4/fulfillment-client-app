# Google Cloud Console OAuth Configuration Checklist

**Date:** November 4, 2025
**Purpose:** Ensure Google OAuth is correctly configured for fulfillment_client_app

---

## 📋 What You Need to Check

Google OAuth redirect URIs must EXACTLY match your callback URLs, or users will see `redirect_uri_mismatch` errors.

---

## ✅ Step-by-Step Checklist

### 1. Go to Google Cloud Console

**URL:** https://console.cloud.google.com/apis/credentials

- **Select Project:** `Sincro Automation Apps` (or your project name)
- **Look for:** OAuth 2.0 Client IDs section

---

### 2. Find Your OAuth Client ID

You should see something like:
- **Name:** `Sincro Automation Apps` or similar
- **Type:** Web application
- **Client ID:** `867246022081-6cjf9qnldp5i9al9ji0cj54cue95nn9t` (example)

**Click on the OAuth Client ID** to edit it.

---

### 3. Check Authorized JavaScript Origins

In the **"Authorized JavaScript origins"** section, verify these URLs are added:

| Environment | URL | Status |
|-------------|-----|--------|
| **Production** | `https://fulfillment-client-app-production.up.railway.app` | ❓ Check this |
| **Local Dev** | `http://localhost:3000` | ❓ Optional (if testing locally) |

**Important:**
- ✅ Must be HTTPS for production (Railway)
- ✅ No trailing slash
- ✅ Must match exactly

---

### 4. Check Authorized Redirect URIs ⚠️ CRITICAL

In the **"Authorized redirect URIs"** section, verify these URLs are added:

| Environment | Redirect URI | Status |
|-------------|--------------|--------|
| **Production** | `https://fulfillment-client-app-production.up.railway.app/auth/google/callback` | ❓ **CHECK THIS** |
| **Local Dev** | `http://localhost:3000/auth/google/callback` | ❓ Optional |

**Important:**
- ⚠️ **This is the most common issue!**
- ✅ Must end with `/auth/google/callback`
- ✅ No trailing slash after `callback`
- ✅ Must be HTTPS for production
- ✅ Must match Railway URL EXACTLY

---

### 5. Compare with Other Apps

Your other Sincro apps should already have redirect URIs configured:

**Attendance App:**
```
https://sincro-attendance.up.railway.app/auth/google/callback
```

**Maintenance App:**
```
https://sincro-maintenance.up.railway.app/auth/google/callback
```

**Sincro Access:**
```
https://sincro-access.up.railway.app/auth/google/callback
```

**Fulfillment App (ADD THIS):**
```
https://fulfillment-client-app-production.up.railway.app/auth/google/callback
```

---

## 🚨 Common Mistakes

### ❌ Wrong Format Examples:

```
# WRONG - No /auth/google/callback path
https://fulfillment-client-app-production.up.railway.app

# WRONG - Trailing slash
https://fulfillment-client-app-production.up.railway.app/auth/google/callback/

# WRONG - HTTP instead of HTTPS (for production)
http://fulfillment-client-app-production.up.railway.app/auth/google/callback

# WRONG - Different subdomain
https://fulfillment-app-production.up.railway.app/auth/google/callback
```

### ✅ Correct Format:

```
https://fulfillment-client-app-production.up.railway.app/auth/google/callback
```

---

## 🔍 How to Find Your Railway URL

If you're not sure what your Railway URL is:

1. Go to: https://railway.app/dashboard
2. Click on: **fulfillment-client-app-production** service
3. Look at: **Settings** → **Domains**
4. Your URL will be something like: `fulfillment-client-app-production.up.railway.app`

---

## 🧪 Testing After Adding Redirect URI

### Test 1: Sign In with Tony's Account
1. Go to your fulfillment app URL
2. Click "Sign in with Google"
3. Choose `tony.orr@easyship.com`
4. Should redirect back successfully ✅

### Test 2: Sign In with Ian's Account
1. Sign out if logged in
2. Click "Sign in with Google"
3. Choose `ian@gosincro.com`
4. Should now work! ✅ (after Railway deploys with new code)

### Test 3: New User
1. Sign out
2. Try signing in with a new Google account
3. Should see access request form ✅

---

## 🎯 What You Should See

### If Redirect URI is MISSING:
```
Error: redirect_uri_mismatch
The redirect URI in the request: https://fulfillment-client-app-production.up.railway.app/auth/google/callback
does not match the ones authorized for the OAuth client.
```

### If Redirect URI is CORRECT:
- ✅ Google OAuth consent screen appears
- ✅ User can select account
- ✅ Redirects back to your app successfully

---

## 📝 Quick Verification Command

After adding the redirect URI, wait 5 minutes for Google to update, then test:

```bash
# Check if redirect URI is working
curl -I "https://fulfillment-client-app-production.up.railway.app/auth/google"
```

Should redirect to Google OAuth (status 302).

---

## ✅ Final Checklist

Before leaving Google Cloud Console:

- [ ] OAuth Client ID is for "Sincro Automation Apps" project
- [ ] Authorized JavaScript origins includes your Railway URL
- [ ] Authorized redirect URIs includes: `https://fulfillment-client-app-production.up.railway.app/auth/google/callback`
- [ ] No trailing slashes
- [ ] HTTPS (not HTTP) for production
- [ ] Clicked **"SAVE"** button at bottom
- [ ] Waited 5 minutes for changes to propagate

---

## 🔧 If You Still Get redirect_uri_mismatch

### Check Railway Environment Variables:

**In Railway → fulfillment-client-app → Variables:**

| Variable | Should Be |
|----------|-----------|
| `GOOGLE_CALLBACK_URL` | `https://fulfillment-client-app-production.up.railway.app/auth/google/callback` |

**Common issue:** The `GOOGLE_CALLBACK_URL` variable doesn't match the redirect URI in Google Cloud Console.

**Fix:** Update Railway variable to match exactly what you added to Google Cloud Console.

---

## 📚 Reference

**Google Cloud Console:** https://console.cloud.google.com/apis/credentials
**Railway Dashboard:** https://railway.app/dashboard
**OAuth Credentials:** See `C:\Users\Tony\automations\docs\archive\oauth\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md`

---

**Status:** Review and add fulfillment app redirect URI
**Priority:** HIGH - Required for OAuth to work
**Time:** 2 minutes to add, 5 minutes to propagate
