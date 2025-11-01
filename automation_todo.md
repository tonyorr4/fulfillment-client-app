# Automation System - Development Plan

**Project:** Dynamic Automation System for Sincro Fulfillment Client App
**Goal:** Replace hard-coded automations with admin-configurable rule-based system
**Started:** November 1, 2025
**Status:** Planning Phase

---

## 📋 User Requirements

### Automation Builder Type
- **Rule-based builder** (condition builder with AND/OR logic + action lists)
- Similar to filter builders in analytics tools
- Good balance of power and simplicity

### Migration Strategy
- **Migrate everything** - Remove ALL hard-coded automations
- Recreate existing automations as default rules in new system
- Clean slate approach

### Condition Complexity
- **Advanced nested logic** support required
- Boolean expressions with parentheses: `(A OR B) AND (C OR D)`
- Multiple condition groups with AND/OR operators

### Action Types (Priority Order)
1. **Change status** - Auto-update client status based on conditions
2. **Create/assign subtasks** - Auto-create subtasks with templates and assignees
3. ~~Send notifications~~ - **EXCLUDED** (email rules stay hard-coded)

---

## 🎯 Scope of Automations to Migrate

### 1. Auto-Approval Logic ✅
**Current Location:** `server.js` lines 320-353
**Trigger:** Client request submission
**Current Logic:**
```javascript
requiresManualReview = battery === 'Yes' ||
                       numPallets === '50-100' || numPallets === '>100' ||
                       numSkus === '50-100' || numSkus === '>100'
autoApproved = !requiresManualReview
status = autoApproved ? 'signing' : 'new-request'
```

**Convert to Automation Rule:**
```
WHEN: Client created
IF: (battery = 'No') AND (numPallets NOT IN ['50-100', '>100']) AND (numSkus NOT IN ['50-100', '>100'])
THEN:
  - Set status = 'signing'
  - Set auto_approved = true
ELSE:
  - Set status = 'new-request'
  - Set auto_approved = false
```

---

### 2. Client Setup Subtask Creation ✅
**Current Location:** `server.js` lines 421-441
**Trigger:** Status changed to 'client-setup'
**Current Logic:**
- Creates "Security deposit confirmation" subtask assigned to Sales Team
- Creates "WMS Setup (Client and billing parameters)" subtask assigned to Fulfillment Ops

**Convert to Automation Rule:**
```
WHEN: Client status changed to 'client-setup'
THEN:
  - Create subtask: "Security deposit confirmation"
    - Assign to: {sales_team} (dynamic field)
    - Mark as auto_created

  - Create subtask: "WMS Setup (Client and billing parameters)"
    - Assign to: {fulfillment_ops} (dynamic field)
    - Mark as auto_created
```

---

### 3. Fulfillment Ops Auto-Assignment ✅
**Current Location:** `server.js` line 349
**Current Logic:** `fulfillment_ops: 'Ian'` (hard-coded)

**Convert to Automation Rule:**
```
WHEN: Client created
THEN:
  - Set fulfillment_ops = 'Ian'
```

**Note:** This could be enhanced to allow dynamic assignment based on workload, client type, etc.

---

## 🏗️ System Architecture

### Database Schema

#### New Table: `automations`
Stores automation rules configured by admins.

```sql
CREATE TABLE automations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_event VARCHAR(100) NOT NULL,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    execution_order INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_automations_trigger ON automations(trigger_event) WHERE enabled = true;
CREATE INDEX idx_automations_order ON automations(execution_order);
```

**Field Descriptions:**
- `name` - Human-readable automation name (e.g., "Auto-approve simple clients")
- `description` - Optional detailed explanation
- `trigger_event` - Event that activates this automation
  - `client_created`
  - `status_changed`
  - `approval_changed`
  - `subtask_completed`
  - `client_updated`
- `conditions` - JSONB structure defining when to execute (see below)
- `actions` - JSONB array of actions to perform (see below)
- `enabled` - Whether this automation is active
- `execution_order` - Order to execute (lower = earlier, for multiple automations on same trigger)

---

#### New Table: `automation_logs`
Tracks automation executions for debugging and audit trail.

```sql
CREATE TABLE automation_logs (
    id SERIAL PRIMARY KEY,
    automation_id INTEGER REFERENCES automations(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    trigger_event VARCHAR(100) NOT NULL,
    conditions_met BOOLEAN NOT NULL,
    actions_executed JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_automation_logs_client ON automation_logs(client_id);
CREATE INDEX idx_automation_logs_created ON automation_logs(created_at DESC);
CREATE INDEX idx_automation_logs_automation ON automation_logs(automation_id);
```

---

### Condition Structure (JSONB)

Supports advanced nested boolean logic.

**Structure:**
```json
{
  "type": "group",
  "operator": "AND",
  "conditions": [
    {
      "type": "condition",
      "field": "battery",
      "operator": "equals",
      "value": "No"
    },
    {
      "type": "group",
      "operator": "OR",
      "conditions": [
        {
          "type": "condition",
          "field": "num_pallets",
          "operator": "equals",
          "value": "1-10"
        },
        {
          "type": "condition",
          "field": "num_pallets",
          "operator": "equals",
          "value": "10-50"
        }
      ]
    }
  ]
}
```

**Condition Operators:**
- `equals` / `not_equals`
- `greater_than` / `less_than` / `greater_or_equal` / `less_or_equal`
- `contains` / `not_contains` (for text fields)
- `in` / `not_in` (for array values)
- `is_empty` / `is_not_empty`
- `is_true` / `is_false` (for boolean fields)

**Group Operators:**
- `AND` - All conditions must be true
- `OR` - At least one condition must be true

**Field Types:**
- Client fields: `battery`, `heavy_sku`, `num_pallets`, `num_skus`, `client_type`, `avg_orders`, `status`, `client_approved`, `special_packaging`, `barcoding`
- System fields: `auto_approved`, `created_at`, `updated_at`
- User fields: `sales_team`, `fulfillment_ops`

---

### Action Structure (JSONB)

Array of actions to execute when conditions are met.

**Structure:**
```json
[
  {
    "type": "set_field",
    "field": "status",
    "value": "signing"
  },
  {
    "type": "set_field",
    "field": "auto_approved",
    "value": true
  },
  {
    "type": "create_subtask",
    "text": "Security deposit confirmation",
    "assignee_field": "sales_team",
    "mark_auto_created": true
  },
  {
    "type": "create_subtask",
    "text": "WMS Setup (Client and billing parameters)",
    "assignee_field": "fulfillment_ops",
    "mark_auto_created": true
  }
]
```

**Action Types:**

#### 1. `set_field`
Sets a client field to a specific value.
```json
{
  "type": "set_field",
  "field": "status",
  "value": "signing"
}
```

#### 2. `create_subtask`
Creates a new subtask for the client.
```json
{
  "type": "create_subtask",
  "text": "Task description here",
  "assignee_field": "sales_team",
  "assignee_static": "Ian",
  "mark_auto_created": true
}
```
- `assignee_field` - Use value from client field (e.g., "sales_team")
- `assignee_static` - Use hard-coded assignee name
- One of `assignee_field` or `assignee_static` can be used, not both

#### 3. `set_multiple_fields` (batch operation)
Sets multiple fields at once.
```json
{
  "type": "set_multiple_fields",
  "fields": {
    "status": "signing",
    "auto_approved": true,
    "client_approved": "Yes"
  }
}
```

---

## 🎨 Frontend UI Design

### Admin Tab Access
- New tab in main navigation: "⚙️ Automations" (admin-only)
- Show/hide based on `user.role === 'Admin'` or `user.is_admin === true`
- Placed after existing tabs in `public/index.html`

### Automation List View
```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Automations                                [+ New Rule]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ✅ Auto-approve simple clients           [Edit] [❌]  │  │
│  │ Trigger: Client created                               │  │
│  │ Conditions: battery=No AND pallets≤50 AND skus≤100   │  │
│  │ Actions: Set status=signing, Set auto_approved=true  │  │
│  │ Order: 1 │ Created: Oct 31, 2025 │ By: Tony Orr      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ✅ Create client setup subtasks          [Edit] [❌]  │  │
│  │ Trigger: Status changed to 'client-setup'             │  │
│  │ Conditions: (none)                                    │  │
│  │ Actions: Create 2 subtasks with assignments          │  │
│  │ Order: 2 │ Created: Oct 31, 2025 │ By: Tony Orr      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ⏸️ Auto-assign Ian to all clients        [Edit] [❌]  │  │
│  │ Trigger: Client created                               │  │
│  │ Conditions: (none)                                    │  │
│  │ Actions: Set fulfillment_ops=Ian                      │  │
│  │ Order: 3 │ Created: Oct 31, 2025 │ By: Tony Orr      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

### Rule Builder Modal

**Step 1: Basic Info**
```
┌─────────────────────────────────────────────────────┐
│  Create New Automation                              │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Name: [Auto-approve simple clients____________]    │
│                                                       │
│  Description (optional):                             │
│  [Automatically approve clients with no special___] │
│  [requirements (no battery, low SKU/pallet count)] │
│                                                       │
│  Trigger Event:                                      │
│  [▼ Client created                              ]   │
│     Options:                                         │
│     - Client created                                 │
│     - Status changed                                 │
│     - Approval changed                               │
│     - Subtask completed                              │
│     - Client updated                                 │
│                                                       │
│  Execution Order: [1] (lower runs first)            │
│                                                       │
│  Status: [x] Enabled                                 │
│                                                       │
│                            [Cancel]  [Next: Conditions →] │
└─────────────────────────────────────────────────────┘
```

---

**Step 2: Condition Builder**
```
┌─────────────────────────────────────────────────────────────┐
│  Conditions (Advanced Builder)                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  When should this automation run?                           │
│  [▼ Always (no conditions)] or [▼ Only when conditions met] │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [AND ▼] Condition Group 1                     [+ ▼] │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                       │   │
│  │  ├─ [battery ▼] [equals ▼] [No ▼]            [×]   │   │
│  │  │                                                   │   │
│  │  ├─ [num_pallets ▼] [not in ▼] ['50-100','>100']   │   │
│  │  │                                            [×]   │   │
│  │  └─ [num_skus ▼] [not in ▼] ['50-100', '>100'] [×]│   │
│  │                                                       │   │
│  │  [+ Add Condition] [+ Add Nested Group]              │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  [+ Add Condition Group (OR)]                                │
│                                                               │
│  Preview: (battery = "No") AND (num_pallets NOT IN          │
│           ["50-100", ">100"]) AND (num_skus NOT IN          │
│           ["50-100", ">100"])                                │
│                                                               │
│                             [← Back]  [Next: Actions →]     │
└─────────────────────────────────────────────────────────────┘
```

**Condition Builder Features:**
- Drag-and-drop to reorder conditions
- Nested groups with visual indentation
- AND/OR operators for each group
- Field dropdown (all client fields + system fields)
- Operator dropdown (context-aware based on field type)
- Value input (text, number, dropdown based on field)
- Delete button (×) for each condition
- "Add Condition" and "Add Nested Group" buttons
- Real-time preview of condition expression

---

**Step 3: Actions Builder**
```
┌─────────────────────────────────────────────────────────────┐
│  Actions                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  What should happen when conditions are met?                 │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Action 1: Set field                              [×] │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Field: [status ▼]                                   │   │
│  │  Value: [signing ▼]                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Action 2: Set field                              [×] │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Field: [auto_approved ▼]                            │   │
│  │  Value: [x] True                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  [+ Add Action ▼]                                            │
│     - Set field                                              │
│     - Create subtask                                         │
│     - Set multiple fields                                    │
│                                                               │
│                              [← Back]  [Save Automation]    │
└─────────────────────────────────────────────────────────────┘
```

**Create Subtask Action UI:**
```
┌─────────────────────────────────────────────────────┐
│ Action: Create subtask                          [×] │
├─────────────────────────────────────────────────────┤
│  Task text:                                          │
│  [Security deposit confirmation_______________]    │
│                                                       │
│  Assign to:                                          │
│  ( ) Specific person: [Ian ▼]                       │
│  (•) Use client field: [sales_team ▼]               │
│                                                       │
│  [x] Mark as auto-created                            │
└─────────────────────────────────────────────────────┘
```

---

### Automation Log Viewer (Optional)
Admin panel showing recent automation executions for debugging.

```
┌─────────────────────────────────────────────────────────────┐
│  Automation Execution Log                    [Filter ▼]     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Nov 1, 10:23 AM │ Auto-approve simple clients              │
│  Client: SFC-123 "Acme Corp"                                │
│  Trigger: Client created                                     │
│  ✅ Conditions met │ ✅ Actions executed (2) │ 45ms         │
│  └─ Set status=signing, Set auto_approved=true              │
│                                                               │
│  Nov 1, 10:15 AM │ Create client setup subtasks             │
│  Client: SFC-122 "Beta Inc"                                 │
│  Trigger: Status changed to 'client-setup'                  │
│  ✅ Conditions met │ ✅ Actions executed (2) │ 67ms         │
│  └─ Created 2 subtasks                                       │
│                                                               │
│  Nov 1, 9:45 AM │ Auto-approve simple clients               │
│  Client: SFC-121 "Gamma LLC"                                │
│  Trigger: Client created                                     │
│  ❌ Conditions not met │ ⏭️ Skipped │ 12ms                   │
│  └─ battery = "Yes" (failed condition)                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Backend Implementation

### New API Endpoints

#### Automation Management
```
GET    /api/automations              - List all automations
GET    /api/automations/:id          - Get single automation
POST   /api/automations              - Create new automation
PATCH  /api/automations/:id          - Update automation
DELETE /api/automations/:id          - Delete automation
PATCH  /api/automations/:id/toggle   - Enable/disable automation
POST   /api/automations/reorder      - Update execution order
```

#### Automation Logs
```
GET    /api/automation-logs          - Get execution logs (paginated)
GET    /api/automation-logs/:id      - Get single log entry
DELETE /api/automation-logs/:id      - Delete log entry
```

**Note:** All endpoints require `ensureAuthenticated` + `checkAutoAdmin` middleware (admin-only).

---

### Automation Execution Engine

**File:** `automation-engine.js` (new file)

**Core Functions:**

#### 1. `evaluateConditions(conditions, clientData)`
Recursively evaluates condition tree against client data.

```javascript
function evaluateConditions(conditions, clientData) {
  if (conditions.type === 'condition') {
    return evaluateSingleCondition(conditions, clientData);
  }

  if (conditions.type === 'group') {
    const results = conditions.conditions.map(c =>
      evaluateConditions(c, clientData)
    );

    if (conditions.operator === 'AND') {
      return results.every(r => r === true);
    } else if (conditions.operator === 'OR') {
      return results.some(r => r === true);
    }
  }

  return false;
}
```

#### 2. `executeActions(actions, clientId, clientData)`
Executes array of actions sequentially.

```javascript
async function executeActions(actions, clientId, clientData) {
  const results = [];

  for (const action of actions) {
    if (action.type === 'set_field') {
      await setClientField(clientId, action.field, action.value);
      results.push({ action: 'set_field', field: action.field, value: action.value });
    }

    if (action.type === 'create_subtask') {
      const assignee = action.assignee_field
        ? clientData[action.assignee_field]
        : action.assignee_static;

      await createSubtask(clientId, action.text, assignee, action.mark_auto_created);
      results.push({ action: 'create_subtask', text: action.text, assignee });
    }

    // ... other action types
  }

  return results;
}
```

#### 3. `triggerAutomations(event, clientId, clientData)`
Main entry point called from API endpoints.

```javascript
async function triggerAutomations(event, clientId, clientData) {
  // Get all enabled automations for this trigger, ordered by execution_order
  const automations = await db.query(
    `SELECT * FROM automations
     WHERE trigger_event = $1 AND enabled = true
     ORDER BY execution_order ASC`,
    [event]
  );

  for (const automation of automations.rows) {
    const startTime = Date.now();
    let conditionsMet = false;
    let actionsExecuted = [];
    let errorMessage = null;

    try {
      // Evaluate conditions
      conditionsMet = evaluateConditions(automation.conditions, clientData);

      // Execute actions if conditions met
      if (conditionsMet) {
        actionsExecuted = await executeActions(
          automation.actions,
          clientId,
          clientData
        );
      }
    } catch (error) {
      errorMessage = error.message;
      console.error(`Automation ${automation.id} failed:`, error);
    }

    // Log execution
    await db.query(
      `INSERT INTO automation_logs
       (automation_id, client_id, trigger_event, conditions_met,
        actions_executed, error_message, execution_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        automation.id,
        clientId,
        event,
        conditionsMet,
        JSON.stringify(actionsExecuted),
        errorMessage,
        Date.now() - startTime
      ]
    );
  }
}
```

---

### Integration Points

Replace hard-coded automation logic with `triggerAutomations()` calls.

#### 1. Client Creation (`POST /api/clients`)
**Before:**
```javascript
// Hard-coded auto-approval logic
const requiresManualReview = battery === 'Yes' || ...;
const autoApproved = !requiresManualReview;
const status = autoApproved ? 'signing' : 'new-request';
```

**After:**
```javascript
// Create client with default status
const result = await db.query(
  `INSERT INTO clients (...) VALUES (...) RETURNING *`
);
const client = result.rows[0];

// Trigger automations
await triggerAutomations('client_created', client.id, client);

// Re-fetch client to get updated fields from automations
const updated = await db.query(
  `SELECT * FROM clients WHERE id = $1`,
  [client.id]
);
return updated.rows[0];
```

---

#### 2. Status Change (`PATCH /api/clients/:id/status`)
**Before:**
```javascript
// Update status
await db.query(`UPDATE clients SET status = $1 WHERE id = $2`, [newStatus, id]);

// Hard-coded subtask creation for client-setup
if (newStatus === 'client-setup') {
  await db.query(`INSERT INTO subtasks ...`);
  await db.query(`INSERT INTO subtasks ...`);
}
```

**After:**
```javascript
// Update status
await db.query(`UPDATE clients SET status = $1 WHERE id = $2`, [newStatus, id]);

// Get updated client data
const result = await db.query(`SELECT * FROM clients WHERE id = $1`, [id]);
const client = result.rows[0];

// Trigger automations
await triggerAutomations('status_changed', id, client);
```

---

#### 3. Approval Change (`PATCH /api/clients/:id/approval`)
**After:**
```javascript
await db.query(
  `UPDATE clients SET client_approved = $1 WHERE id = $2`,
  [decision, id]
);

const result = await db.query(`SELECT * FROM clients WHERE id = $1`, [id]);
const client = result.rows[0];

await triggerAutomations('approval_changed', id, client);
```

---

#### 4. Subtask Completion (`PATCH /api/subtasks/:id/toggle`)
**After:**
```javascript
await db.query(
  `UPDATE subtasks SET completed = $1 WHERE id = $2`,
  [completed, subtaskId]
);

// Get client associated with this subtask
const result = await db.query(
  `SELECT c.* FROM clients c
   JOIN subtasks s ON s.client_id = c.id
   WHERE s.id = $1`,
  [subtaskId]
);
const client = result.rows[0];

if (completed) {
  await triggerAutomations('subtask_completed', client.id, client);
}
```

---

## 📦 Default Automations (Seed Data)

Create initial automations to replicate existing hard-coded behavior.

**File:** `migrations/seed-default-automations.js`

### Automation 1: Auto-Approve Simple Clients
```javascript
{
  name: 'Auto-approve simple clients',
  description: 'Automatically approve clients with no batteries, low SKU count, and low pallet count',
  trigger_event: 'client_created',
  execution_order: 1,
  enabled: true,
  conditions: {
    type: 'group',
    operator: 'AND',
    conditions: [
      { type: 'condition', field: 'battery', operator: 'equals', value: 'No' },
      {
        type: 'condition',
        field: 'num_pallets',
        operator: 'not_in',
        value: ['50-100', '>100']
      },
      {
        type: 'condition',
        field: 'num_skus',
        operator: 'not_in',
        value: ['50-100', '>100']
      }
    ]
  },
  actions: [
    { type: 'set_field', field: 'status', value: 'signing' },
    { type: 'set_field', field: 'auto_approved', value: true }
  ]
}
```

### Automation 2: Create Client Setup Subtasks
```javascript
{
  name: 'Create client setup subtasks',
  description: 'Auto-create security deposit and WMS setup subtasks when client moves to setup phase',
  trigger_event: 'status_changed',
  execution_order: 1,
  enabled: true,
  conditions: {
    type: 'condition',
    field: 'status',
    operator: 'equals',
    value: 'client-setup'
  },
  actions: [
    {
      type: 'create_subtask',
      text: 'Security deposit confirmation',
      assignee_field: 'sales_team',
      mark_auto_created: true
    },
    {
      type: 'create_subtask',
      text: 'WMS Setup (Client and billing parameters)',
      assignee_field: 'fulfillment_ops',
      mark_auto_created: true
    }
  ]
}
```

### Automation 3: Auto-Assign Ian to Fulfillment Ops
```javascript
{
  name: 'Auto-assign Ian to fulfillment ops',
  description: 'Automatically assign Ian as the fulfillment ops for all new clients',
  trigger_event: 'client_created',
  execution_order: 0, // Execute before approval automation
  enabled: true,
  conditions: {
    type: 'group',
    operator: 'AND',
    conditions: [] // No conditions (always run)
  },
  actions: [
    { type: 'set_field', field: 'fulfillment_ops', value: 'Ian' }
  ]
}
```

---

## ✅ Development Tasks

### Phase 1: Database & Backend Core
- [ ] Create database migration for `automations` table
- [ ] Create database migration for `automation_logs` table
- [ ] Run migrations on development database
- [ ] Create `automation-engine.js` with core evaluation logic
  - [ ] Implement `evaluateSingleCondition()` function
  - [ ] Implement `evaluateConditions()` recursive function
  - [ ] Implement `executeActions()` function
  - [ ] Implement `triggerAutomations()` main function
- [ ] Create `database.js` helper functions
  - [ ] `getAutomationsByTrigger(event)` - Query automations
  - [ ] `setClientField(clientId, field, value)` - Update client field
  - [ ] `createSubtask(clientId, text, assignee, autoCreated)` - Create subtask
  - [ ] `logAutomationExecution(...)` - Insert log entry
- [ ] Unit test automation engine with sample data
- [ ] Test condition evaluation (simple, nested, edge cases)
- [ ] Test action execution (set field, create subtask)

### Phase 2: API Endpoints
- [ ] Create automation management endpoints in `server.js`
  - [ ] GET `/api/automations` - List all (with filtering)
  - [ ] GET `/api/automations/:id` - Get single automation
  - [ ] POST `/api/automations` - Create new automation
  - [ ] PATCH `/api/automations/:id` - Update automation
  - [ ] DELETE `/api/automations/:id` - Delete automation
  - [ ] PATCH `/api/automations/:id/toggle` - Enable/disable
  - [ ] POST `/api/automations/reorder` - Update execution order
- [ ] Add `checkAutoAdmin` middleware to all automation endpoints
- [ ] Create automation log endpoints
  - [ ] GET `/api/automation-logs` - List logs (paginated, filterable)
  - [ ] GET `/api/automation-logs/:id` - Get single log
  - [ ] DELETE `/api/automation-logs/:id` - Delete log
- [ ] Test all endpoints with Postman/Thunder Client
- [ ] Validate JSONB structure on POST/PATCH (prevent invalid data)

### Phase 3: Integration with Existing Endpoints
- [ ] Update POST `/api/clients` (client creation)
  - [ ] Remove hard-coded auto-approval logic
  - [ ] Remove hard-coded fulfillment_ops assignment
  - [ ] Add `await triggerAutomations('client_created', ...)`
  - [ ] Test that auto-approval still works via automations
- [ ] Update PATCH `/api/clients/:id/status` (status change)
  - [ ] Remove hard-coded subtask creation for client-setup
  - [ ] Add `await triggerAutomations('status_changed', ...)`
  - [ ] Test that subtask creation still works via automations
- [ ] Update PATCH `/api/clients/:id/approval` (approval change)
  - [ ] Add `await triggerAutomations('approval_changed', ...)`
- [ ] Update PATCH `/api/subtasks/:id/toggle` (subtask completion)
  - [ ] Add `await triggerAutomations('subtask_completed', ...)`
- [ ] Test end-to-end workflows
  - [ ] Create client → Verify auto-approval
  - [ ] Change status to client-setup → Verify subtasks created
  - [ ] Complete subtask → Verify logs

### Phase 4: Seed Default Automations
- [ ] Create migration script `migrations/seed-default-automations.js`
- [ ] Insert default automation: Auto-approve simple clients
- [ ] Insert default automation: Create client setup subtasks
- [ ] Insert default automation: Auto-assign Ian to fulfillment ops
- [ ] Run seed migration on development database
- [ ] Test that default automations work as expected
- [ ] Verify execution order is correct

### Phase 5: Frontend - Automations Tab
- [ ] Add "Automations" tab to navigation in `public/index.html`
  - [ ] Add tab element with ⚙️ icon
  - [ ] Add content div for automations panel
  - [ ] Show/hide based on user role (admin only)
- [ ] Create automation list view in `public/app.js`
  - [ ] Fetch automations from `/api/automations`
  - [ ] Display automation cards with name, trigger, summary
  - [ ] Show enabled/disabled status (toggle switch)
  - [ ] Show execution order
  - [ ] Add "New Automation" button
  - [ ] Add Edit/Delete buttons per automation
- [ ] Implement toggle automation on/off
  - [ ] Call PATCH `/api/automations/:id/toggle`
  - [ ] Update UI optimistically
- [ ] Implement delete automation
  - [ ] Show confirmation dialog
  - [ ] Call DELETE `/api/automations/:id`
  - [ ] Remove from list

### Phase 6: Frontend - Rule Builder Modal
- [ ] Create modal structure (3-step wizard)
  - [ ] Step 1: Basic info (name, description, trigger, order)
  - [ ] Step 2: Condition builder
  - [ ] Step 3: Action builder
  - [ ] Navigation: Back/Next/Save buttons
- [ ] Step 1: Basic Info Form
  - [ ] Name input (required)
  - [ ] Description textarea (optional)
  - [ ] Trigger event dropdown (client_created, status_changed, etc.)
  - [ ] Execution order number input
  - [ ] Enabled checkbox
  - [ ] Validation: Name required, trigger required
- [ ] Step 2: Condition Builder UI
  - [ ] "Always run" vs "Only when conditions met" toggle
  - [ ] Condition group container (AND/OR operator selector)
  - [ ] Add condition button
  - [ ] Condition row: Field dropdown, Operator dropdown, Value input
  - [ ] Delete condition button
  - [ ] Nested group support (Add Group button)
  - [ ] Visual indentation for nested groups
  - [ ] Condition preview (human-readable text)
  - [ ] Field options: All client fields + system fields
  - [ ] Operator options: Context-aware based on field type
  - [ ] Value input: Dynamic (text/number/dropdown) based on field
- [ ] Step 3: Action Builder UI
  - [ ] Action list container
  - [ ] Add action dropdown (Set field, Create subtask, etc.)
  - [ ] Set Field action:
    - [ ] Field dropdown (writable fields only)
    - [ ] Value input (context-aware)
  - [ ] Create Subtask action:
    - [ ] Task text input
    - [ ] Assignee: Radio (specific person vs client field)
    - [ ] Assignee person dropdown (if specific)
    - [ ] Assignee field dropdown (if client field)
    - [ ] "Mark as auto-created" checkbox
  - [ ] Delete action button per action
  - [ ] Drag-and-drop reorder actions
- [ ] Form validation
  - [ ] At least one action required
  - [ ] Condition syntax validation
  - [ ] Required fields in actions
- [ ] Save automation
  - [ ] POST `/api/automations` (new) or PATCH (edit)
  - [ ] Handle success/error responses
  - [ ] Close modal and refresh list
  - [ ] Show success toast notification

### Phase 7: Frontend - Automation Logs (Optional)
- [ ] Create "View Logs" button in automation list
- [ ] Create automation logs modal
  - [ ] Fetch logs from `/api/automation-logs`
  - [ ] Display log entries (timestamp, client, trigger, result)
  - [ ] Show success/failure/skipped status
  - [ ] Show execution time
  - [ ] Show error messages if any
  - [ ] Filter by automation, client, date range
  - [ ] Pagination controls
- [ ] Add delete log button (admin only)

### Phase 8: Testing & Refinement
- [ ] End-to-end testing
  - [ ] Create automation via UI → Verify saved in DB
  - [ ] Edit automation → Verify updated
  - [ ] Delete automation → Verify removed
  - [ ] Toggle automation → Verify enabled/disabled
  - [ ] Create client → Verify automations execute
  - [ ] Complex nested conditions → Verify correct evaluation
  - [ ] Multiple automations on same trigger → Verify execution order
- [ ] Error handling
  - [ ] Invalid condition syntax → Show user-friendly error
  - [ ] Invalid action data → Show error and prevent save
  - [ ] Automation execution failure → Log error, don't crash
  - [ ] Network errors → Retry logic or user notification
- [ ] Performance testing
  - [ ] 100+ automations in list → Check load time
  - [ ] Complex condition trees → Check evaluation speed
  - [ ] Multiple automations per trigger → Check total execution time
- [ ] UI/UX polish
  - [ ] Loading states (spinners)
  - [ ] Empty states ("No automations yet")
  - [ ] Success/error toast notifications
  - [ ] Confirmation dialogs (delete, disable)
  - [ ] Responsive design (mobile-friendly)
  - [ ] Accessibility (keyboard navigation, ARIA labels)

### Phase 9: Documentation & Deployment
- [ ] Update README.md with automation system documentation
  - [ ] Overview of automation system
  - [ ] How to create/edit automations
  - [ ] Condition syntax guide
  - [ ] Action types reference
  - [ ] Trigger events reference
- [ ] Create user guide for Tony
  - [ ] Screenshots of UI
  - [ ] Step-by-step walkthrough
  - [ ] Common automation examples
  - [ ] Troubleshooting tips
- [ ] Update database migration documentation
- [ ] Test on staging environment
  - [ ] Run migrations
  - [ ] Seed default automations
  - [ ] Test client creation flow
  - [ ] Test status change flow
  - [ ] Verify emails still send (hard-coded)
- [ ] Deploy to production
  - [ ] Run migrations
  - [ ] Seed default automations
  - [ ] Monitor logs for errors
  - [ ] Verify existing workflows still work
- [ ] Post-deployment monitoring
  - [ ] Check automation logs for errors
  - [ ] Verify performance (execution times)
  - [ ] Get user feedback from Tony
  - [ ] Fix any bugs or issues

---

## 🚀 Future Enhancements (Post-MVP)

### Advanced Features
- [ ] **Automation Templates** - Pre-built automations for common scenarios
- [ ] **Duplicate Automation** - Clone existing automation as starting point
- [ ] **Import/Export** - JSON export/import for sharing automations
- [ ] **Automation Testing** - "Test this automation" button with sample data
- [ ] **Visual Workflow Editor** - Drag-and-drop node-based builder
- [ ] **Scheduling** - Run automations on schedule (e.g., daily at 9am)
- [ ] **Conditional Actions** - If-else logic within action list
- [ ] **Custom JavaScript Actions** - Advanced users can write custom code
- [ ] **Webhook Actions** - Call external APIs (Slack, CRM, etc.)
- [ ] **Email Actions** - Send custom emails from automations
- [ ] **Batch Operations** - Run automation on multiple clients at once
- [ ] **Automation Analytics** - Dashboard with execution stats
- [ ] **Version History** - Track changes to automations over time
- [ ] **Rollback** - Revert to previous version of automation
- [ ] **Collaboration** - Multiple admins can edit automations
- [ ] **Automation Permissions** - Fine-grained control over who can edit
- [ ] **Field Validation** - Ensure client data meets criteria before save
- [ ] **Computed Fields** - Auto-calculate fields based on other fields

### Integration Features
- [ ] **Slack Integration** - Auto-create channels, post messages
- [ ] **CRM Integration** - Sync client data with CRM
- [ ] **Calendar Integration** - Create calendar events for dates
- [ ] **File Storage Integration** - Auto-upload documents
- [ ] **Payment Integration** - Trigger payment requests
- [ ] **Reporting Integration** - Auto-generate reports

---

## 📝 Notes & Considerations

### Performance
- **Execution Order:** Lower number = higher priority. Default to 0 if not specified.
- **Optimization:** Index on `trigger_event` and `enabled` for fast lookups
- **Caching:** Consider caching automations in memory (invalidate on update)
- **Async Execution:** Automations run synchronously per client (no race conditions)
- **Timeout:** Add max execution time per automation (e.g., 10 seconds)

### Security
- **Admin-Only Access:** All automation management requires admin role
- **JSONB Validation:** Validate structure before saving to prevent malformed data
- **Action Whitelisting:** Only allow approved action types (prevent arbitrary code execution)
- **Field Whitelisting:** Only allow updates to approved fields
- **SQL Injection:** Use parameterized queries for all database operations

### Backwards Compatibility
- **Email Notifications:** Keep hard-coded (as user requested)
- **Existing Clients:** Automations apply to new events only (no retroactive execution)
- **Migration Path:** Default automations replicate exact existing behavior

### User Experience
- **Visual Feedback:** Show loading states, success/error messages
- **Error Recovery:** Allow editing automation if save fails (don't lose work)
- **Undo/Redo:** Consider undo functionality for destructive actions
- **Keyboard Shortcuts:** Power users appreciate keyboard navigation

### Testing Strategy
- **Unit Tests:** Test condition evaluation and action execution in isolation
- **Integration Tests:** Test full automation flow (trigger → evaluate → execute)
- **End-to-End Tests:** Test via UI (create automation → verify execution)
- **Edge Cases:** Empty conditions, malformed JSON, circular dependencies
- **Performance Tests:** Large condition trees, many automations per trigger

---

## 📞 Questions for Tony

1. **Execution Order Conflicts:** If two automations on the same trigger both set the same field to different values, which wins? (Currently: execution_order determines priority, last one wins)

2. **Failed Automations:** If an automation fails (e.g., database error), should we:
   - Stop executing remaining automations?
   - Continue to next automation and log the error?
   - Retry failed automations?

3. **Audit Trail:** Should automation-triggered changes appear in the activity log? (e.g., "Automation: Auto-approve simple clients set status to signing")

4. **Manual Override:** If an automation sets a field, can a user manually change it back? Or should automations re-trigger and override manual changes?

5. **Automation Conflicts:** What if two automations try to set the same field to different values? Priority by execution_order?

6. **Delete Protection:** Should there be a confirmation when deleting automations with execution history? Or ability to archive instead of delete?

7. **Mobile Access:** Is mobile support for the automation builder needed? Or desktop-only is fine?

8. **Multi-Tenant:** This codebase uses a shared database with other Sincro apps. Should automations from the Fulfillment app be isolated from other apps' data?

---

**Status:** Ready to Begin Implementation
**Next Step:** Phase 1 - Database & Backend Core
**Estimated Total Dev Time:** 30-40 hours
**Estimated Completion:** November 8-10, 2025
