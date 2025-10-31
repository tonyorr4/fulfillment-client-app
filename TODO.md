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
**Status:** Not Started
**Priority:** 🟠 High
**Description:** Currently subtasks show assignee initials but there's no way to assign or change the assignee. Need dropdown to select assignee when creating subtask.

**Requirements:**
- [ ] Add assignee dropdown when creating new subtask
- [ ] Dropdown should show all approved users (Admin, Sr. Ops, Supervisor, Sales, Viewer roles)
- [ ] Default to current user
- [ ] Allow changing assignee on existing subtasks
- [ ] Store assignee name in subtasks table

**API Changes Needed:**
- [ ] GET /api/users/all - fetch all approved users for assignee dropdown
- [ ] Modify POST /api/clients/:id/subtasks to accept assignee parameter
- [ ] Add PATCH /api/subtasks/:id/assignee to change assignee

**Files to Modify:**
- `server.js` - Add new endpoints
- `public/index.html` - Add assignee dropdown to subtask creation
- `public/app.js` - Update addSubtask function

---

### 4. Email Notifications System
**Status:** Not Started
**Priority:** 🟠 High
**Description:** Implement email notifications using Brevo for various client tile events.

#### 4.1 Request Submission Notification
**Recipient:** Sales team member who submitted the request
**Trigger:** When client request is submitted
**Content:**
- Subject: "Fulfillment Request [Auto-Approved/Pending Review] - [Client Name]"
- Summary of request details
- Outcome: Auto-approved → moved to Signing OR Pending → awaiting manual review
- Link to client tile

**Tasks:**
- [ ] Create email template for request submission
- [ ] Send email after client creation in POST /api/clients
- [ ] Include all relevant client details
- [ ] Different message for auto-approved vs. manual review

#### 4.2 Comment/Mention Notification
**Recipient:** All users assigned to the client tile (sales_team, fulfillment_ops)
**Trigger:** When someone adds a comment or mentions someone on a client tile
**Content:**
- Subject: "New Comment on [Client Name]"
- Comment text
- Who posted it
- Link to client tile

**Tasks:**
- [ ] Parse mentions from comment text (e.g., @Tony Orr)
- [ ] Get list of assigned users from client record
- [ ] Send email to all assigned users + mentioned users
- [ ] Create comment notification email template

#### 4.3 Tony's Always-Notify Rule
**Recipient:** tony.orr@easyship.com
**Trigger:** ANY update to ANY client tile
**Events to notify:**
- New request created
- Status changed
- Approval decision made
- Comment added
- Subtask completed
- Assignment changed

**Tasks:**
- [ ] Create a notifyTony() helper function
- [ ] Call notifyTony() on all client update operations
- [ ] Create digest email template for Tony with all changes
- [ ] Optional: Daily summary email instead of individual notifications

**Email Implementation:**
- [ ] Verify Brevo API key is set in environment variables
- [ ] Verify sender email is configured
- [ ] Create email template helper functions
- [ ] Test email delivery

**Files to Modify:**
- `server.js` - Add email notification calls to all relevant endpoints
- Create new file: `email-service.js` - Email helper functions
- Environment: Verify BREVO_API_KEY, BREVO_SENDER_EMAIL

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

### 7. Slack Integration - Client Tile Summary
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

### 7. Better Subtask Management
- [ ] Ability to edit subtask text
- [ ] Ability to delete subtasks
- [ ] Subtask due dates
- [ ] Subtask priority levels

### 8. Advanced Filtering/Search
- [ ] Filter tiles by sales team member
- [ ] Filter tiles by date range
- [ ] Filter by client type
- [ ] Advanced search with multiple criteria

### 9. Analytics Dashboard
- [ ] Average time in each status
- [ ] Approval rate (auto vs manual)
- [ ] Sales team performance metrics
- [ ] Client type distribution

### 10. Export Functionality
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

- ✅ **Working:** Basic Kanban board, OAuth authentication, client creation, drag-and-drop, form data persistence, sales team display
- ⚠️ **Needs Fix:** None
- 🚧 **In Progress:** None
- ❌ **Not Started:** Email notifications, permissions, Slack integration, subtask assignment

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

# Need to verify/add:
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=notifications@easyship.com
ADMIN_NOTIFICATION_EMAIL=tony.orr@easyship.com

# Need to add for Slack:
SLACK_WEBHOOK_URL=https://hooks.slack.com/... (or)
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=#fulfillment-updates
```

### Database Schema Changes Needed:
- None currently - existing schema supports all features

### New Files to Create:
- `email-service.js` - Email notification helper functions
- `slack-service.js` - Slack integration helper functions
- `permissions.js` - Permission checking middleware

---

**Ready to start? Let me know which issue/feature to tackle first!**
