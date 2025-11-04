# Ian Auto-Assignment Automation Guide

## Overview

This guide explains how to set up an automation that **automatically assigns Ian** to the `fulfillment_ops` field whenever a new client tile is created in the Fulfillment Client App.

---

## How It Works

The automation system in this app uses **trigger-based rules** that execute actions when certain events occur:

- **Trigger Event**: `client_created` (fires when a new client tile is created)
- **Condition**: None (applies to ALL new clients)
- **Action**: Set `fulfillment_ops` field to "Ian"
- **Execution Order**: 0 (runs first, before other automations)

### Workflow:
1. User creates a new client tile in the UI
2. Server creates the client record in database
3. Automation engine is triggered with `client_created` event
4. Ian assignment automation runs
5. `fulfillment_ops` field is automatically set to "Ian"
6. Other automations run (auto-approval, subtask creation, etc.)

---

## Quick Start (3 Options)

### Option 1: Run the Seed Script (Recommended)

This creates all default automations including Ian assignment:

```bash
cd C:\Users\Tony\automations\fulfillment_client_app
node migrations/seed-default-automations.js
```

**What it creates:**
- ✅ Auto-assign Ian to fulfillment ops
- ✅ Auto-approve simple clients
- ✅ Create client setup subtasks

---

### Option 2: Run the Ian-Only Script

If you only want the Ian automation:

```bash
cd C:\Users\Tony\automations\fulfillment_client_app
node create-ian-automation.js
```

This script:
- Creates the Ian auto-assignment automation
- Checks if it already exists (won't duplicate)
- Enables it if it's disabled
- Provides detailed output

---

### Option 3: Create Via UI (Manual)

If you prefer to create it manually through the app UI:

1. Start the app: `npm start`
2. Go to **Automations** tab
3. Click **Create New Automation**
4. Fill in these values:

**Automation Details:**
- **Name**: `Auto-assign Ian to fulfillment ops`
- **Description**: `Automatically assign Ian as the fulfillment ops for all new clients`
- **Trigger Event**: `client_created`
- **Execution Order**: `0`
- **Enabled**: ✅ Yes

**Conditions:**
- Leave empty (or create an empty AND group)
- This makes it apply to ALL new clients

**Actions:**
- **Action Type**: `Set Field`
- **Field**: `fulfillment_ops`
- **Value**: `Ian`

5. Click **Save**

---

## Verify It's Working

### Method 1: Check Database

Run the check script:

```bash
node check-ian-automation.js
```

This shows:
- ✅ Whether the automation exists
- ✅ If it's enabled
- ✅ Full automation details
- ✅ All automations in the system

### Method 2: Check Via UI

1. Open the app
2. Go to **Automations** tab
3. Look for **"Auto-assign Ian to fulfillment ops"**
4. Verify it's **ENABLED** (green toggle)
5. Check execution order is **0**

### Method 3: Test It

1. Create a new client tile
2. After creation, check the client details
3. The `fulfillment_ops` field should show **"Ian"**
4. Check the Activity Log for automation execution

---

## Troubleshooting

### Automation Not Running

**Check if automation exists:**
```bash
node check-ian-automation.js
```

**If it doesn't exist:**
```bash
node create-ian-automation.js
```

**If it exists but disabled:**
- Go to Automations tab in UI
- Find "Auto-assign Ian to fulfillment ops"
- Toggle it to ENABLED

### Database Connection Error

If you see `ECONNREFUSED` error:

1. **Check if database is running:**
   - Local: Start PostgreSQL service
   - Railway: Database should always be running

2. **Check DATABASE_URL in .env:**
   ```
   DATABASE_URL=postgresql://user:password@host:5432/database
   ```

3. **Test connection:**
   ```bash
   node verify-setup.js
   ```

### Automation Exists But Not Working

1. **Check execution order**: Should be `0` to run first
2. **Check enabled status**: Must be enabled
3. **Check trigger event**: Must be `client_created`
4. **Check action syntax**:
   ```json
   {
     "type": "set_field",
     "field": "fulfillment_ops",
     "value": "Ian"
   }
   ```

5. **Check server logs**: Look for automation execution messages
   ```
   🤖 Triggering automations for client_created event...
   ✓ Automations completed: X/Y executed
   ```

---

## How to Modify the Automation

### Change the Assigned Person

To assign someone other than Ian:

**Via UI:**
1. Go to Automations tab
2. Click edit on "Auto-assign Ian to fulfillment ops"
3. Change the Value field to different name
4. Save

**Via Script:**
Edit `create-ian-automation.js`, change line:
```javascript
"value": "Ian"  // Change to "John" or whoever
```

### Add Conditions

To only assign Ian to certain clients:

**Example: Only assign Ian if battery = "No"**

1. Go to Automations tab
2. Edit the automation
3. Add condition:
   - Field: `battery`
   - Operator: `equals`
   - Value: `No`
4. Save

### Disable the Automation

**Via UI:**
- Toggle to disabled in Automations tab

**Via Script:**
```sql
UPDATE automations
SET enabled = false
WHERE name = 'Auto-assign Ian to fulfillment ops';
```

---

## Technical Details

### Database Schema

The automation is stored in the `automations` table:

```sql
id: 1
name: "Auto-assign Ian to fulfillment ops"
trigger_event: "client_created"
conditions: {"type": "group", "operator": "AND", "conditions": []}
actions: [{"type": "set_field", "field": "fulfillment_ops", "value": "Ian"}]
enabled: true
execution_order: 0
```

### Code Flow

1. **Client creation** (`server.js:426`):
   ```javascript
   let newClient = await createClient(clientData);
   ```

2. **Trigger automations** (`server.js:432`):
   ```javascript
   await triggerAutomations(pool, 'client_created', newClient.id, newClient, userId);
   ```

3. **Automation engine** (`automation-engine.js:271`):
   - Fetches all enabled automations with trigger `client_created`
   - Sorts by `execution_order`
   - Evaluates conditions
   - Executes actions

4. **Set field action** (`automation-engine.js:122`):
   ```javascript
   await setClientField(pool, clientId, 'fulfillment_ops', 'Ian');
   ```

### Allowed Fields

The automation can only update these fields:
- `status`
- `client_approved`
- `auto_approved`
- `fulfillment_ops` ✅ (what we're using)
- `sales_team`
- `heavy_sku`
- `special_packaging`
- `barcoding`

### Audit Trail

All automation actions are logged in `activity_log` table:
- Action: `automation_field_update`
- Details include: automation name, field changed, new value

---

## Examples

### Current Setup (Ian for Everyone)

```json
{
  "name": "Auto-assign Ian to fulfillment ops",
  "trigger_event": "client_created",
  "conditions": {
    "type": "group",
    "operator": "AND",
    "conditions": []
  },
  "actions": [
    {
      "type": "set_field",
      "field": "fulfillment_ops",
      "value": "Ian"
    }
  ],
  "enabled": true,
  "execution_order": 0
}
```

### Example: Ian for High Priority Only

```json
{
  "conditions": {
    "type": "group",
    "operator": "AND",
    "conditions": [
      {
        "type": "condition",
        "field": "num_pallets",
        "operator": "in",
        "value": ["50-100", ">100"]
      }
    ]
  }
}
```

### Example: Ian for Specific Sales Team

```json
{
  "conditions": {
    "type": "condition",
    "field": "sales_team",
    "operator": "equals",
    "value": "John"
  }
}
```

---

## Summary

✅ **The automation already exists** in your codebase (`migrations/seed-default-automations.js`)

✅ **To activate it**: Run `node migrations/seed-default-automations.js`

✅ **To verify it**: Run `node check-ian-automation.js`

✅ **To create it separately**: Run `node create-ian-automation.js`

✅ **Result**: All new client tiles will automatically have Ian assigned!

---

## Need Help?

- Check the logs: `node check-automation-logs.js`
- Verify system: `node verify-automation-system.js`
- Test automations: `node test-automation-engine.js`
- View all automations in UI: Go to **Automations** tab

---

**Last Updated**: 2025-01-04
