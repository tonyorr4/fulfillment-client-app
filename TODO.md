# Fulfillment Client App - TODO List

**Last Updated:** October 30, 2025
**Priority Legend:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 CRITICAL ISSUES (Must Fix Immediately)

### 1. Form Data Not Persisting to Client Tiles
**Status:** ✅ COMPLETE & VERIFIED
**Priority:** 🔴 Critical
**Issue:** When a new client request is submitted, the form input data is not appearing on the completed client tile. Client detail modal was showing hardcoded mock data.

**Resolution:**
- [x] Audited form field names - ALL MATCH server expectations ✅
- [x] Added comprehensive debugging logging throughout the data flow ✅
- [x] Removed ALL hardcoded data from client detail modal sidebar ✅
- [x] Fully implemented updateSidebarFields() function to populate real data ✅
- [x] User testing confirmed tiles and detail modal show correct data ✅

**Completed:** October 30, 2025

**Debugging Added:**
- ✅ POST /api/clients: Log request body received
- ✅ POST /api/clients: Log clientData before database insert
- ✅ POST /api/clients: Log newClient after database insert
- ✅ GET /api/clients: Log clients fetched and sent to frontend
- ✅ Frontend: Log clients received from API
- ✅ Frontend: Log data used to create each card

**Next Steps:**
1. User submits a new client request in deployed app
2. Check Railway logs to see what data is received/stored
3. Check browser console (F12) to see what data frontend receives
4. Identify where data is lost or incorrect
5. Apply fix

**Files Modified:**
- `server.js` - Added logging to POST /api/clients and GET /api/clients
- `public/app.js` - Added logging to loadAllClients and createClientCardElement

---

### 2. Sales Team Assignment Shows "Loading" on Tiles
**Status:** ✅ COMPLETE & VERIFIED
**Priority:** 🔴 Critical
**Issue:** The "Assigned To" section in client detail modal was showing "Loading..." instead of the actual sales team member name.

**Root Cause:**
- Client detail modal had a `<select>` dropdown with id="detailSalesTeamSelect" that was never being populated
- The dropdown had placeholder text "Loading..." that never changed
- This was different from the New Request form dropdown which works correctly

**Resolution:**
- [x] Replaced Sales Team dropdown with text display ✅
- [x] Replaced Fulfillment Ops dropdown with text display ✅
- [x] Updated updateSidebarFields() to populate both assignment fields ✅
- [x] Added logging to verify sales_team value is being set ✅
- [x] User testing confirmed fix works ✅

**Note:** Assignment fields are now read-only text displays. Editing assignments will be implemented as part of Feature #6 (Editable Client Details).

**Completed:** October 30, 2025

---

## 🟠 HIGH PRIORITY FEATURES

### 3. Subtask Assignment to Specific People
**Status:** ✅ COMPLETE & VERIFIED
**Priority:** 🟠 High
**Description:** Subtasks can now be assigned to specific people when creating or editing them. Users are filtered by app-specific access control.

**Resolution:**
- [x] Add assignee dropdown when creating new subtask ✅
- [x] Dropdown shows full user names (not initials) ✅
- [x] Filters users by active access to Fulfillment app via user_app_access table ✅
- [x] Defaults to current user ✅
- [x] Allow changing assignee on existing subtasks via dropdown ✅
- [x] Store assignee name in subtasks table ✅

**API Changes Implemented:**
- [x] GET /api/users/all - fetches users with active access to Fulfillment app (app_id = 5) via user_app_access join ✅
- [x] POST /api/clients/:id/subtasks already accepted assignee parameter ✅
- [x] PATCH /api/subtasks/:id/assignee - changes assignee on existing subtasks ✅

**Files Modified:**
- `server.js` - Added GET /api/users/all and PATCH /api/subtasks/:id/assignee endpoints with app-specific filtering
- `public/index.html` - Added assignee dropdown to subtask creation with CSS styling
- `public/app.js` - Updated addSubtask function and loadSubtasksIntoModal to handle assignee selection

**Database Architecture:**
- Uses shared Sincro database with user_app_access table for cross-app access control
- Fulfillment app (app_id = 5) only shows users with active=TRUE for that app
- Prevents showing users from other Sincro apps (Maintenance, Access, etc.)

**Completed:** October 31, 2025
**User Testing:** ✅ Verified in production

---

### 4. Email Notifications System
**Status:** ✅ COMPLETE & VERIFIED
**Priority:** 🟠 High
**Description:** Implement email notifications using Brevo for various client tile events.

**Resolution:**
- [x] Created notifyTony() helper function for all client events ✅
- [x] Updated sendNewRequestNotification() to send to sales team member + Tony ✅
- [x] Added sendStatusChangeNotification() for status changes ✅
- [x] Added sendSubtaskCompletionNotification() for completed subtasks ✅
- [x] Added sendApprovalDecisionNotification() for approval decisions ✅
- [x] Integrated notifications into 7 endpoints (clients, status, approval, subtasks, comments) ✅
- [x] Configured Brevo environment variables in Railway ✅
- [x] Tested email delivery - confirmed working ✅

**Completed:** October 31, 2025

**Email Events Implemented:**
1. **New Request Created** → Sends to sales team member + Tony
   - Subject: `Fulfillment Request [Auto-Approved/Pending Review] - [Client Name]`
   - Includes all client details, auto-approval status, link to app

2. **Status Changed** → Sends to Tony
   - Subject: `[Fulfillment] Status Changed to [Status] - [Client Name]`
   - Shows old status → new status

3. **Approval Decision** → Sends to Tony
   - Subject: `[Fulfillment] Approval Decision: [Approved/Rejected] - [Client Name]`
   - Shows who made the decision

4. **Subtask Completed** → Sends to Tony
   - Subject: `[Fulfillment] Subtask Completed - [Client Name]`
   - Shows subtask text and who completed it

5. **Subtask Created** → Sends to Tony
   - Subject: `[Fulfillment] New Subtask Created - [Client Name]`
   - Shows subtask text and assignee

6. **Assignee Changed** → Sends to Tony
   - Subject: `[Fulfillment] Assignment Changed - [Client Name]`
   - Shows subtask and new assignee

7. **Comment Added** → Sends to Tony + mentioned users
   - Subject: `[Fulfillment] Comment Added - [Client Name]` (Tony)
   - Subject: `You were mentioned in [Client Name]` (mentioned users)
   - Shows commenter, comment text, link to app

**Environment Variables Configured:**
- `BREVO_API_KEY` = Brevo API key
- `BREVO_SENDER_EMAIL` = tony.orr@easyship.com
- `APP_URL` = Production app URL

**Files Modified:**
- `email-service.js` - Added all notification functions with HTML/text templates
- `server.js` - Integrated email calls into all relevant endpoints

**User Testing:** ✅ Verified in production - both sales team and Tony notifications working

---

### 5. Role-Based Permissions
**Status:** Not Started
**Priority:** 🟠 High
**Description:** Implement proper role-based access control for different user types.

#### Permission Matrix

| Action | Sales | Admin | Sr. Ops | Supervisor | Fulfillment | Viewer |
|--------|-------|-------|---------|------------|-------------|--------|
| Create new request | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View all tiles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Complete subtasks | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Add comments | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Change status (move tiles) | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Approve clients | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete clients | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit assignments | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Access admin settings | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Tasks:**
- [ ] Create permission checking middleware in backend
- [ ] Add role checks to all API endpoints
- [ ] Frontend: Hide/disable UI elements based on user role
- [ ] Frontend: Hide status dropdown for Sales role users
- [ ] Frontend: Disable drag-and-drop for Sales role users
- [ ] Test each role's permissions thoroughly

**Files to Modify:**
- `server.js` - Add permission middleware to endpoints
- `auth-config.js` - Add permission checking functions
- `public/app.js` - Conditional UI rendering based on role

---

## 🟡 MEDIUM PRIORITY FEATURES

### 6. Editable Client Details in Client Tile
**Status:** Not Started
**Priority:** 🟡 Medium
**Description:** Make client details editable directly within the client tile detail modal. Currently all fields are read-only.

**Requirements:**
- [ ] Make all client detail fields editable (inline editing or edit mode)
- [ ] Fields to make editable:
  - Client Name
  - Email
  - Client Type
  - Avg Orders/Month
  - Number of SKUs
  - Battery/DG
  - Heavy SKU
  - Number of Pallets
  - Special Packaging
  - Barcoding
  - Additional Info/Description
- [ ] Add "Edit" / "Save" / "Cancel" buttons
- [ ] Validate required fields before saving
- [ ] Update database with new values
- [ ] Show success/error messages
- [ ] Refresh tile display after save

**Implementation Options:**
1. **Inline editing:** Click field → becomes editable → click elsewhere to save
2. **Edit mode:** Click "Edit" button → all fields become editable → "Save" / "Cancel"
3. **Edit modal:** Click "Edit" button → opens separate edit form modal

**Recommended Approach:** Edit mode (option 2) - cleaner UX, clear save/cancel actions

**API Changes Needed:**
- [ ] Add PATCH /api/clients/:id endpoint to update client fields
- [ ] Validation on server side
- [ ] Log updates to activity_log

**Files to Modify:**
- `public/index.html` - Add edit/save/cancel buttons, make fields editable
- `public/app.js` - Add edit mode functionality, save handler
- `server.js` - Add PATCH endpoint for updating client

---

### 7. @Mention Autocomplete in Comments
**Status:** Not Started
**Priority:** 🟡 Medium
**Description:** Add autocomplete/typeahead functionality when typing "@" in comment box to mention users.

**Requirements:**
- [ ] Detect when user types "@" in comment textarea
- [ ] Show dropdown popup with list of all Fulfillment app users
- [ ] Filter user list as user continues typing (e.g., "@To" shows "Tony Orr")
- [ ] Allow user to select from filtered list (click or keyboard navigation)
- [ ] Insert selected user's name into comment (e.g., "@Tony Orr")
- [ ] Parse @mentions from comment text and extract user IDs
- [ ] Send mentionedUsers array to backend API
- [ ] Style mention dropdown to match app design

**Implementation Approach:**
1. **Frontend - Autocomplete UI:**
   - Listen for "@" keypress in comment textarea
   - Show absolutely positioned dropdown below cursor
   - Populate with `allUsers` array (already loaded)
   - Filter list based on characters typed after "@"
   - Handle arrow key navigation and Enter to select
   - Insert mention on selection

2. **Frontend - Mention Parsing:**
   - Extract all @mentions from comment text using regex
   - Match mention names to user IDs from `allUsers` array
   - Pass `mentionedUsers: [userId1, userId2, ...]` to POST /api/clients/:id/comments

3. **Backend (Already Complete):**
   - ✅ Server already accepts `mentionedUsers` array
   - ✅ Server already sends emails to mentioned users via `sendMentionNotification()`

**Files to Modify:**
- `public/app.js` - Add autocomplete logic and mention parsing
- `public/styles.css` - Style mention dropdown
- `public/index.html` - May need dropdown container element

**Libraries to Consider:**
- Option 1: Build custom autocomplete (lightweight, full control)
- Option 2: Use library like Tribute.js (specialized for @mentions)

**Example UX:**
```
User types: "Hey @"
  → Dropdown shows: [Tony Orr, Ian, Austin Mashburn, ...]

User types: "Hey @To"
  → Dropdown shows: [Tony Orr]

User selects "Tony Orr"
  → Comment becomes: "Hey @Tony Orr "
  → mentionedUsers array includes Tony's user ID
```

---

### 8. Slack Integration - Client Tile Summary
**Status:** Not Started
**Priority:** 🟡 Medium
**Description:** Send Slack notifications/summaries for client tile updates.

**Requirements:**
- [ ] Set up Slack App and get webhook URL or bot token
- [ ] Determine which events trigger Slack notifications
  - New request created?
  - Status changed?
  - Client approved/rejected?
  - Subtasks completed?
- [ ] Create Slack message templates with formatted blocks
- [ ] Include link to client tile in app
- [ ] Determine which Slack channel(s) to post to

**Questions for User:**
1. **What Slack channel(s) should receive notifications?**
   - Single channel for all updates?
   - Different channels per status/stage?

2. **What events should trigger Slack notifications?**
   - Every comment?
   - Only status changes?
   - New requests only?

3. **What information should be in the Slack summary?**
   - Full client details?
   - Just status updates?
   - Assigned team members?

4. **Do you want to use Slack Webhooks or Slack Bot API?**
   - Webhooks (simpler, one-way only)
   - Bot API (can read messages, more complex)

**Tasks (pending answers):**
- [ ] Set up Slack integration credentials
- [ ] Add SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN to environment
- [ ] Create slack-service.js with notification functions
- [ ] Integrate Slack notifications into relevant endpoints
- [ ] Test Slack message formatting

**Files to Create/Modify:**
- Create new file: `slack-service.js`
- `server.js` - Add Slack notification calls
- `.env` - Add Slack credentials

---

## 🟢 LOW PRIORITY / FUTURE ENHANCEMENTS

### 9. Better Subtask Management
- [ ] Ability to edit subtask text
- [ ] Ability to delete subtasks
- [ ] Subtask due dates
- [ ] Subtask priority levels

### 10. Advanced Filtering/Search
- [ ] Filter tiles by sales team member
- [ ] Filter tiles by date range
- [ ] Filter by client type
- [ ] Advanced search with multiple criteria

### 11. Analytics Dashboard
- [ ] Average time in each status
- [ ] Approval rate (auto vs manual)
- [ ] Sales team performance metrics
- [ ] Client type distribution

### 12. Export Functionality
- [ ] Export clients to CSV
- [ ] Export filtered view to Excel
- [ ] Generate PDF reports

---

## 📝 QUESTIONS FOR USER

### Email Notifications:
1. **For Tony's notifications:** Do you want individual emails for each event, or a daily digest summary?
2. **Email frequency:** Should comment notifications be instant, or batched (e.g., every 30 minutes)?
3. **Email templates:** Do you have specific branding/formatting requirements for emails?

### Slack Integration:
4. **Slack channel name(s):** Where should notifications be posted?
5. **Notification triggers:** Which events should send Slack messages?
6. **Slack summary format:** What information should be included?
7. **Integration type:** Webhook (simple) or Bot API (advanced)?

### Subtask Assignment:
8. **Default assignee:** Should new subtasks default to the fulfillment ops person, or the current user?
9. **Auto-created subtasks:** Who should they be assigned to by default?

### Permissions:
10. **Sales role clarification:** Can sales users see ALL client tiles, or only ones they created?
11. **Viewer role:** Are viewers read-only for everything, or can they view specific tiles?

---

## 🎯 SUGGESTED IMPLEMENTATION ORDER

**Week 1 - Critical Fixes:**
1. Fix form data not persisting (Issue #1)
2. Fix sales team assignment showing "Loading" (Issue #2)

**Week 2 - Core Features:**
3. Implement role-based permissions (Feature #5)
4. Add subtask assignment functionality (Feature #3)

**Week 3 - Notifications:**
5. Implement email notifications system (Feature #4)
   - Start with request submission emails
   - Add comment notifications
   - Add Tony's always-notify

**Week 4 - Integration:**
6. Implement Slack integration (Feature #6) - after answering questions

---

## 📊 CURRENT STATUS SUMMARY

- ✅ **Working:** Basic Kanban board, OAuth authentication, client creation, drag-and-drop, form data persistence, sales team display, subtask assignment, email notifications
- ⚠️ **Needs Fix:** None
- 🚧 **In Progress:** None
- ❌ **Not Started:** Permissions, Slack integration

---

## 🔧 TECHNICAL NOTES

### Environment Variables Needed:
```env
# Already configured:
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
AUTO_ADMIN_EMAIL=tony.orr@easyship.com
BREVO_API_KEY=xkeysib-... ✅
BREVO_SENDER_EMAIL=tony.orr@easyship.com ✅
APP_URL=[Railway production URL] ✅

# Need to add for Slack:
SLACK_WEBHOOK_URL=https://hooks.slack.com/... (or)
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=#fulfillment-updates
```

### Database Schema Changes Needed:
- None currently - existing schema supports all features

### Files Created:
- ✅ `email-service.js` - Email notification helper functions

### New Files to Create:
- `slack-service.js` - Slack integration helper functions
- `permissions.js` - Permission checking middleware

---

**Ready to start? Let me know which issue/feature to tackle first!**
