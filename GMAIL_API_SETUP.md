# Gmail API Setup Guide

This guide will help you set up Gmail API with OAuth2 to send emails via HTTPS (bypassing Railway's SMTP blocks).

## Part 1: Google Cloud Console Setup (5-10 minutes)

### 1. Create/Select Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click the project dropdown at the top
3. Click **"New Project"** or select existing project
4. Name: `Sincro Fulfillment` (or any name)
5. Click **"Create"**

### 2. Enable Gmail API

1. In the search bar, type **"Gmail API"**
2. Click on **"Gmail API"**
3. Click **"Enable"**
4. Wait for it to enable (~30 seconds)

### 3. Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **"External"** (unless you have a Google Workspace)
3. Click **"Create"**

**Fill in the form:**
- **App name:** `Sincro Fulfillment`
- **User support email:** Your email (tony.orr@easyship.com)
- **Developer contact email:** Your email
- Click **"Save and Continue"**

**Scopes page:**
- Click **"Add or Remove Scopes"**
- Search for `gmail.send`
- Check the box for `https://www.googleapis.com/auth/gmail.send`
- Click **"Update"**
- Click **"Save and Continue"**

**Test users page:**
- Click **"Add Users"**
- Add email: `tony.orr@easyship.com`
- Click **"Add"**
- Click **"Save and Continue"**

### 4. Create OAuth2 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Application type: **"Desktop app"** (or "Web application")
4. Name: `Sincro Fulfillment Email`
5. Click **"Create"**

**Important:** Copy these values immediately!
- **Client ID:** (looks like: `xxxxx.apps.googleusercontent.com`)
- **Client Secret:** (looks like: `GOCSPX-xxxxx`)

6. Click **"Download JSON"** and save it somewhere safe
7. **DO NOT CLOSE THIS PAGE YET** - you'll need these values

---

## Part 2: Generate Refresh Token (5 minutes)

Now we'll generate a refresh token that allows the app to send emails on your behalf.

### 1. Add Credentials to .env

Open your `.env` file and add these (use the values from Google Cloud Console):

```env
# Gmail API OAuth2 (replaces SMTP)
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-your-client-secret
GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback
GMAIL_USER=tony.orr@easyship.com
```

### 2. Run the OAuth Setup Script

In your terminal, run:

```bash
node setup-gmail-oauth.js
```

This will:
1. Open your browser automatically
2. Ask you to authorize the app
3. Generate a refresh token
4. Save it to your .env file

**Follow the prompts carefully!**

---

## Part 3: Add to Railway (2 minutes)

Once you have the refresh token, add these to Railway environment variables:

1. Go to Railway → Your service → **Variables** tab
2. Add these 4 variables:

```
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-your-client-secret
GMAIL_REFRESH_TOKEN=1//your-long-refresh-token
GMAIL_USER=tony.orr@easyship.com
```

3. Railway will auto-redeploy with the new variables

---

## Part 4: Test

After Railway redeploys:
1. Create a test client in your app
2. Check Railway logs for: `✉️ Email sent successfully via Gmail API`
3. Check your email inbox

---

## Troubleshooting

**Error: "invalid_grant"**
- Refresh token expired or was revoked
- Re-run `node setup-gmail-oauth.js` to get a new token

**Error: "insufficient authentication scopes"**
- Make sure you added the `gmail.send` scope in OAuth consent screen
- Re-authorize the app

**Error: "Access blocked: This app's request is invalid"**
- Make sure you added your email as a test user in OAuth consent screen
- The app must be in "Testing" mode (not "Production" yet)

---

## Why This Works

- ✅ Uses HTTPS (port 443) instead of SMTP ports
- ✅ Railway doesn't block HTTPS
- ✅ Still uses your Gmail account
- ✅ More secure than app passwords
- ✅ Better rate limits (2000 emails/day for free accounts)
