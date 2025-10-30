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
**Value (Local Testing):** `postgresql://postgres:yourpassword@localhost:5432/fulfillment_clients`
**Value (Railway Production):** Automatically provided by Railway when you add PostgreSQL service
**Description:** PostgreSQL connection string
**How to Get:**
- **Local:** Install PostgreSQL, create database `fulfillment_clients`, use your postgres password
- **Railway:** Click "Add PostgreSQL" in Railway dashboard, copy DATABASE_URL from Variables tab

**Example (Local):**
```
DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/fulfillment_clients
```

**Example (Railway - auto-generated):**
```
DATABASE_URL=postgresql://postgres:IbkBfKAGmSsDYugPiQcoeIXZKWtMtuOx@maglev.proxy.rlwy.net:49885/railway
```

---

### 3. GOOGLE_CLIENT_ID
**Variable Name:** `GOOGLE_CLIENT_ID`
**Value:** Your Google OAuth 2.0 Client ID
**Description:** Client ID from Google Cloud Console
**How to Get:**
1. Go to https://console.cloud.google.com/
2. Create new project or select existing
3. Go to "APIs & Services" → "Credentials"
4. Click "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: "Web application"
6. Copy the Client ID

**Example:**
```
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
```

---

### 4. GOOGLE_CLIENT_SECRET
**Variable Name:** `GOOGLE_CLIENT_SECRET`
**Value:** Your Google OAuth 2.0 Client Secret
**Description:** Client Secret from Google Cloud Console
**How to Get:**
1. Same location as Client ID (Google Cloud Console → APIs & Services → Credentials)
2. Copy the Client Secret shown after creating OAuth credentials

**Example:**
```
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
```

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

# Database (Local PostgreSQL)
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/fulfillment_clients

# Google OAuth
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Session Security
SESSION_SECRET=your-super-secret-random-key-change-this-to-something-secure-123456789

# Admin Access
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
| `APP_URL` | `https://your-app-name.railway.app` |
| `GOOGLE_CLIENT_ID` | (same as local) |
| `GOOGLE_CLIENT_SECRET` | (same as local) |
| `GOOGLE_CALLBACK_URL` | `https://your-app-name.railway.app/auth/google/callback` |
| `SESSION_SECRET` | (same as local) |
| `AUTO_ADMIN_EMAIL` | `tony.orr@easyship.com` |
| `BREVO_API_KEY` | (optional - your Brevo key) |
| `BREVO_SENDER_EMAIL` | (optional) `notifications@easyship.com` |
| `ADMIN_NOTIFICATION_EMAIL` | (optional) `tony.orr@easyship.com` |

**Note:** `DATABASE_URL` is automatically added by Railway when you add the PostgreSQL service.

---

## Setup Checklist

### Local Development
- [ ] Install PostgreSQL locally
- [ ] Create database: `createdb fulfillment_clients`
- [ ] Copy `.env.example` to `.env`
- [ ] Set `DATABASE_URL` with your local PostgreSQL credentials
- [ ] Get Google OAuth credentials from Google Cloud Console
- [ ] Add `http://localhost:3000/auth/google/callback` to Google authorized redirect URIs
- [ ] Fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- [ ] Generate random `SESSION_SECRET`
- [ ] Set `AUTO_ADMIN_EMAIL=tony.orr@easyship.com`
- [ ] Run `npm install`
- [ ] Run `npm start`
- [ ] Visit `http://localhost:3000`

### Railway Deployment
- [ ] Push code to GitHub
- [ ] Create new Railway project from GitHub repo
- [ ] Add PostgreSQL service in Railway
- [ ] Copy all environment variables to Railway Variables tab
- [ ] Update `GOOGLE_CALLBACK_URL` to Railway URL
- [ ] Add Railway URL to Google authorized redirect URIs
- [ ] Deploy!

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
