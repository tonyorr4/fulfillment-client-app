# Sincro Fulfillment Client Management

![App Logo](https://i.imgur.com/NGLnWrs.png)

A Jira-like Kanban board application for managing fulfillment clients with automated workflows, subtasks, and team collaboration.

---

## 🚨 CRITICAL: Shared Sincro Database Required

**This app is part of the Sincro OAuth ecosystem and MUST use the shared database.**

### ⚠️ Railway Setup - READ THIS FIRST

**📋 CHECKLIST:** See **[RAILWAY-SETUP-CHECKLIST.md](./RAILWAY-SETUP-CHECKLIST.md)** for complete setup steps

If deploying to Railway, you **MUST** update these environment variables to use shared Sincro credentials:

1. **`DATABASE_URL`** → Shared Sincro database (NOT a separate PostgreSQL service)
   - ✅ **CORRECT:** Hostname = `metro.proxy.rlwy.net`
   - ❌ **WRONG:** Hostname = `maglev.proxy.rlwy.net`
2. **`GOOGLE_CLIENT_ID`** → Shared Sincro OAuth credentials
3. **`GOOGLE_CLIENT_SECRET`** → Shared Sincro OAuth credentials
4. **`AUTO_ADMIN_EMAIL`** → `tony.orr@easyship.com`

**📖 Get actual values from:** `C:\Users\Tony\automations\OAUTH-AND-ACCESS-COMPLETE-SYSTEM.md`

**📋 Detailed guide:** See `SETUP-SHARED-SINCRO-DATABASE.md` in this folder

### Why This Matters:
- ✅ Access requests appear in Sincro Access App
- ✅ Centralized user management across all Sincro apps
- ✅ Single sign-on works across Maintenance, Fulfillment, and Access apps
- ❌ Without this: Access requests go to the wrong database and won't be visible

---

## Features

- **Kanban Board**: 8-column workflow from New Request to Complete
- **Auto-Approval Logic**: Automatically approves clients based on criteria (matching N8N workflow)
- **Automated Subtasks**: Creates assigned tasks when clients move to Client Setup
- **Drag-and-Drop**: Move clients between columns with visual feedback
- **Comments & Mentions**: Tag team members with @ mentions
- **Email Notifications**: Brevo integration for mentions and status updates
- **Google OAuth**: Secure authentication with auto-admin for Tony
- **PostgreSQL Database**: Production-grade data persistence

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Authentication**: Passport.js + Google OAuth 2.0
- **Email**: Brevo (formerly Sendinblue)
- **Security**: Helmet, rate limiting, CORS
- **Frontend**: Vanilla JavaScript (no frameworks)

## Setup Instructions

### 1. Clone and Install

```bash
cd C:\Users\Tony\automations\fulfillment_client_app
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: PostgreSQL connection string
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth secret
- `SESSION_SECRET`: Random secret key
- `BREVO_API_KEY`: Brevo API key (optional)

### 3. Set Up Google OAuth

Follow `GOOGLE-OAUTH-SETUP-GUIDE.md` in the automations folder to:
1. Create Google Cloud project
2. Enable Google+ API
3. Configure OAuth consent screen
4. Create OAuth credentials
5. Add authorized redirect URIs

### 4. Set Up PostgreSQL

**Option A: Local PostgreSQL**
```bash
# Install PostgreSQL locally
# Create database
createdb fulfillment_clients

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://username:password@localhost:5432/fulfillment_clients
```

**Option B: Railway PostgreSQL** (Recommended for production)
- Database will be automatically created when deploying to Railway
- Add PostgreSQL service in Railway dashboard
- Copy DATABASE_URL to environment variables

### 5. Run Locally

```bash
npm start
```

Visit `http://localhost:3000`

## Deployment to Railway

### 1. Prepare for Deployment

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit - Sincro Fulfillment Client App"
```

### 2. Push to GitHub

```bash
git remote add origin https://github.com/your-username/fulfillment-client-app.git
git branch -M main
git push -u origin main
```

### 3. Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Click "Add PostgreSQL" to add database service
6. Add environment variables in Railway dashboard:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL` (https://your-app.railway.app/auth/google/callback)
   - `SESSION_SECRET`
   - `BREVO_API_KEY`
   - `BREVO_SENDER_EMAIL`
   - `ADMIN_NOTIFICATION_EMAIL`
   - `AUTO_ADMIN_EMAIL=tony.orr@easyship.com`
   - `APP_URL` (https://your-app.railway.app)
   - `NODE_ENV=production`

7. **Update Google OAuth redirect URIs** in Google Cloud Console:
   - Add: `https://your-app.railway.app/auth/google/callback`

8. Deploy!

## API Endpoints

### Authentication
- `GET /auth/google` - Initiate Google OAuth login
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/logout` - Logout
- `GET /api/auth/user` - Get current user

### Clients
- `GET /api/clients` - Get all clients
- `GET /api/clients/:id` - Get single client with subtasks and comments
- `POST /api/clients` - Create new client (fulfillment request)
- `PATCH /api/clients/:id/status` - Update client status
- `PATCH /api/clients/:id/approval` - Update client approval
- `DELETE /api/clients/:id` - Delete client (admin only)

### Subtasks
- `GET /api/clients/:id/subtasks` - Get subtasks for client
- `POST /api/clients/:id/subtasks` - Create new subtask
- `PATCH /api/subtasks/:id/toggle` - Toggle subtask completion

### Comments
- `GET /api/clients/:id/comments` - Get comments for client
- `POST /api/clients/:id/comments` - Create new comment

### Utilities
- `GET /api/export` - Export all data (admin only)
- `GET /api/health` - Health check

## Auto-Approval Criteria

Clients are automatically approved if ANY of these conditions are met:
- Battery Included or DG Good = "Yes"
- Est. Number of Pallets = "50-100" or ">100"
- Number of Unique SKUs = "50-100" or ">100"
- Average Orders = ">3000"
- Client Type = "Dropship"

## Automated Workflows

### When Client Moves to "Client Setup":
1. Creates "Security deposit confirmation" subtask → Assigned to Sales Team
2. Creates "WMS Setup (Client and billing parameters)" subtask → Assigned to Fulfillment Ops
3. Sends email notifications to both assignees

## Security Features

- Google OAuth 2.0 authentication
- Helmet.js security headers
- Rate limiting (100 requests per 15 min)
- CORS restrictions
- Session management (8-hour expiration)
- Auto-admin access for tony.orr@easyship.com

## Database Schema

- **users**: OAuth users with active status
- **clients**: Fulfillment requests with all form data
- **comments**: Comments with user mentions
- **subtasks**: Tasks assigned to team members
- **activity_log**: Audit trail of all actions

## Backup & Recovery

- **Automatic**: PostgreSQL daily backups by Railway
- **Manual Export**: `/api/export` endpoint (admin only)
- **Restore**: SQL import via Railway dashboard

## Support

For issues or questions, contact Tony Orr or create an issue in the repository.

---

**Version**: 1.0.0
**Last Updated**: October 30, 2025
**Maintained by**: Tony Orr + Claude
