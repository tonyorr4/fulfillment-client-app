# Environment Variables Setup Guide

This file contains all environment variables needed for the Fulfillment Client App with exact values and instructions.

## Required Variables

### 1. PORT
**Variable Name:** `PORT`
**Value:** `3000`
**Description:** The port your Express server runs on
**Example:**
```
PORT=3000
```

---

### 2. DATABASE_URL
**Variable Name:** `DATABASE_URL`
**Value:** See `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md` for shared Sincro database URL
**Description:** PostgreSQL connection string - **SHARED across all Sincro apps**
**Important:** This app uses the centralized Sincro database for user management

**Why Shared Database:**
- All Sincro apps (Maintenance, Fulfillment, Access) share the same users table
- Access requests appear in Sincro Access App for centralized management
- Single sign-on works across all Sincro applications
- Users approved once get access to all Sincro apps

**Where to Find:**
Check `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md` for the actual connection string.

**Note:** The fulfillment app creates its own tables (clients, comments, subtasks, activity_log) in this shared database, but shares the users and access_requests tables with other Sincro apps.

---

### 3. GOOGLE_CLIENT_ID
**Variable Name:** `GOOGLE_CLIENT_ID`
**Value:** See `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md` for shared Sincro OAuth Client ID
**Description:** Google OAuth 2.0 Client ID - **SHARED across all Sincro apps**
**Important:** This app uses the same Google OAuth credentials as all other Sincro apps

**Where to Find:**
Check `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md` under "OAuth Credentials" section.

---

### 4. GOOGLE_CLIENT_SECRET
**Variable Name:** `GOOGLE_CLIENT_SECRET`
**Value:** See `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md` for shared Sincro OAuth Client Secret
**Description:** Google OAuth 2.0 Client Secret - **SHARED across all Sincro apps**
**Important:** This app uses the same Google OAuth credentials as all other Sincro apps

**Where to Find:**
Check `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md` under "OAuth Credentials" section.

---

### 5. GOOGLE_CALLBACK_URL
**Variable Name:** `GOOGLE_CALLBACK_URL`
**Value (Local):** `http://localhost:3000/auth/google/callback`
**Value (Railway):** `https://your-app-name.railway.app/auth/google/callback`
**Description:** OAuth redirect URI
**Important:** Must match EXACTLY what you add in Google Cloud Console

**Example (Local):**
```
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

**Example (Railway):**
```
GOOGLE_CALLBACK_URL=https://fulfillment-client-app-production.railway.app/auth/google/callback
```

**Note:** You must add this URL to "Authorized redirect URIs" in Google Cloud Console:
- Go to Google Cloud Console → APIs & Services → Credentials
- Click your OAuth 2.0 Client ID
- Add both local and Railway URLs to "Authorized redirect URIs"

---

### 6. SESSION_SECRET
**Variable Name:** `SESSION_SECRET`
**Value:** Any random string (at least 32 characters)
**Description:** Secret key for encrypting session cookies
**How to Generate:** Use any random string generator or type random characters

**Example:**
```
SESSION_SECRET=your-super-secret-random-key-change-this-to-something-secure-123456789
```

**Quick Generate (PowerShell):**
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

### 7. NODE_ENV
**Variable Name:** `NODE_ENV`
**Value (Local):** `development`
**Value (Railway):** `production`
**Description:** Environment mode

**Example (Local):**
```
NODE_ENV=development
```

**Example (Railway):**
```
NODE_ENV=production
```

---

### 8. AUTO_ADMIN_EMAIL
**Variable Name:** `AUTO_ADMIN_EMAIL`
**Value:** `tony.orr@easyship.com`
**Description:** Email that gets automatic admin access

**Example:**
```
AUTO_ADMIN_EMAIL=tony.orr@easyship.com
```

---

### 9. APP_URL
**Variable Name:** `APP_URL`
**Value (Local):** `http://localhost:3000`
**Value (Railway):** `https://your-app-name.railway.app`
**Description:** Base URL of your application

**Example (Local):**
```
APP_URL=http://localhost:3000
```

**Example (Railway):**
```
APP_URL=https://fulfillment-client-app-production.railway.app
```

---

## Optional Variables (Email Notifications)

### 10. BREVO_API_KEY
**Variable Name:** `BREVO_API_KEY`
**Value:** Your Brevo (formerly Sendinblue) API key
**Description:** API key for sending email notifications
**Required:** No (app will work without email notifications)
**How to Get:**
1. Go to https://app.brevo.com/
2. Create account or login
3. Go to "Settings" → "API Keys"
4. Click "Generate a new API key"
5. Copy the API key

**Example:**
```
BREVO_API_KEY=xkeysib-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

---

### 11. BREVO_SENDER_EMAIL
**Variable Name:** `BREVO_SENDER_EMAIL`
**Value:** Email address you want to send notifications from
**Description:** "From" email address for all notifications
**Required:** No (only needed if using Brevo)
**Important:** Must be verified in Brevo dashboard

**Example:**
```
BREVO_SENDER_EMAIL=notifications@easyship.com
```

---

### 12. ADMIN_NOTIFICATION_EMAIL
**Variable Name:** `ADMIN_NOTIFICATION_EMAIL`
**Value:** Email to receive admin notifications
**Description:** Where to send important admin alerts
**Required:** No (only needed if using Brevo)

**Example:**
```
ADMIN_NOTIFICATION_EMAIL=tony.orr@easyship.com
```

---

## Complete .env File Templates

### Local Development .env
```env
# Server Configuration
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000

# Shared Sincro Database (Get from OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md)
DATABASE_URL=postgresql://...

# Shared Sincro Google OAuth (Get from OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md)
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Session Security (Generate unique random string)
SESSION_SECRET=your-super-secret-random-key-change-this-to-something-secure-123456789

# Admin Access (DO NOT CHANGE)
AUTO_ADMIN_EMAIL=tony.orr@easyship.com

# Email Notifications (Optional)
# BREVO_API_KEY=xkeysib-1234567890abcdef
# BREVO_SENDER_EMAIL=notifications@easyship.com
# ADMIN_NOTIFICATION_EMAIL=tony.orr@easyship.com
```

---

### Railway Production Environment Variables

**In Railway Dashboard → Variables Tab, add these:**

| Variable Name | Value |
|---------------|-------|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://fulfillment-client-app-production.up.railway.app` |
| `DATABASE_URL` | See OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md |
| `GOOGLE_CLIENT_ID` | See OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md |
| `GOOGLE_CLIENT_SECRET` | See OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md |
| `GOOGLE_CALLBACK_URL` | `https://fulfillment-client-app-production.up.railway.app/auth/google/callback` |
| `SESSION_SECRET` | (same as local or generate new) |
| `AUTO_ADMIN_EMAIL` | `tony.orr@easyship.com` |
| `BREVO_API_KEY` | (optional - your Brevo key) |
| `BREVO_SENDER_EMAIL` | (optional) `notifications@easyship.com` |
| `ADMIN_NOTIFICATION_EMAIL` | (optional) `tony.orr@easyship.com` |

**IMPORTANT:**
- DATABASE_URL points to the **shared Sincro database**, not a separate Railway PostgreSQL service
- OAuth credentials are **shared with all Sincro apps** (Maintenance, Access, etc.)
- All access requests will appear in your Sincro Access App
- Get actual credential values from `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md`

---

## Setup Checklist

### Local Development
- [ ] Copy `.env.example` to `.env`
- [ ] Use shared Sincro database URL (already provided in docs)
- [ ] Use shared Google OAuth credentials (already provided in docs)
- [ ] Add `http://localhost:3000/auth/google/callback` to Google authorized redirect URIs (if not already added)
- [ ] Generate random `SESSION_SECRET`
- [ ] Confirm `AUTO_ADMIN_EMAIL=tony.orr@easyship.com`
- [ ] Run `npm install`
- [ ] Run `npm start`
- [ ] Visit `http://localhost:3000`

### Railway Deployment
- [ ] Push code to GitHub
- [ ] Create new Railway project from GitHub repo
- [ ] **DO NOT add PostgreSQL service** - use shared Sincro database
- [ ] Copy all environment variables to Railway Variables tab (use shared credentials from this doc)
- [ ] Update `GOOGLE_CALLBACK_URL` to `https://fulfillment-client-app-production.up.railway.app/auth/google/callback`
- [ ] Add Railway URL to Google authorized redirect URIs
- [ ] Deploy!
- [ ] Access requests will appear in Sincro Access App

---

## Troubleshooting

**Problem:** "Error: No DATABASE_URL provided"
**Solution:** Make sure DATABASE_URL is set in .env file or Railway variables

**Problem:** "Google OAuth redirect_uri_mismatch"
**Solution:**
1. Check GOOGLE_CALLBACK_URL matches exactly (http vs https, port number, etc.)
2. Add the URL to "Authorized redirect URIs" in Google Cloud Console
3. Make sure there are no trailing slashes

**Problem:** "Session secret not set"
**Solution:** Add SESSION_SECRET to .env file with a long random string

**Problem:** "Cannot connect to PostgreSQL"
**Solution:**
- Local: Make sure PostgreSQL is running (`pg_ctl status`)
- Railway: Make sure PostgreSQL service is added and DATABASE_URL is set

---

**Last Updated:** October 30, 2025
**Maintained by:** Tony Orr
