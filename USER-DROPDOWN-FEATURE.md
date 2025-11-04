# User Dropdown Feature for Automations

## Summary

Added user dropdown functionality to the Automations tab so that when setting user-related fields (`fulfillment_ops` or `sales_team`), you can select from a dropdown of actual users instead of typing a name.

---

## Changes Made

### 1. Modified Action Value Input (Set Field Action)

**File**: `public/app.js`

**Location**: `addAction()` function (lines ~3163-3188)

**Changes**:
- Added `onchange="updateActionValueInput(this)"` to the field selector
- Wrapped the value input in a container `<div class="action-value-container">`
- This allows dynamic replacement of the input type based on selected field

**Before**:
```html
<select class="action-field">
    <option value="">-- Select field --</option>
    ...
</select>
...
<input type="text" class="action-value" placeholder="Enter value">
```

**After**:
```html
<select class="action-field" onchange="updateActionValueInput(this)">
    <option value="">-- Select field --</option>
    ...
</select>
...
<div class="action-value-container">
    <input type="text" class="action-value" placeholder="Enter value">
</div>
```

---

### 2. Added New Function: `updateActionValueInput()`

**File**: `public/app.js`

**Location**: After `removeAction()` function (lines ~3240-3271)

**Purpose**:
Dynamically changes the value input from text field to user dropdown (or vice versa) based on the selected field.

**Logic**:
```javascript
function updateActionValueInput(fieldSelect) {
    const selectedField = fieldSelect.value;
    const userFields = ['fulfillment_ops', 'sales_team'];

    if (userFields.includes(selectedField)) {
        // Show user dropdown
        container.innerHTML = `
            <select class="action-value">
                <option value="">-- Select user --</option>
                ${allUsers.map(user => `<option value="${user.name}">${user.name}</option>`).join('')}
            </select>
        `;
    } else {
        // Show text input for other fields
        container.innerHTML = `
            <input type="text" class="action-value" placeholder="Enter value" value="${currentValue}">
        `;
    }
}
```

**User Fields Detected**:
- `fulfillment_ops` → Shows user dropdown
- `sales_team` → Shows user dropdown
- All other fields → Shows text input

---

### 3. Updated Edit Automation Loading

**File**: `public/app.js`

**Location**: `editAutomation()` function (lines ~2938-2950)

**Changes**:
When loading an existing automation for editing, now calls `updateActionValueInput()` after setting the field value to ensure the correct input type (dropdown/text) is displayed.

**Before**:
```javascript
lastAction.querySelector('.action-field').value = action.field || '';
lastAction.querySelector('.action-value').value = action.value || '';
```

**After**:
```javascript
const fieldSelect = lastAction.querySelector('.action-field');
fieldSelect.value = action.field || '';

// Update the value input type based on field
updateActionValueInput(fieldSelect);

// Set the value after updating input type
lastAction.querySelector('.action-value').value = action.value || '';
```

---

### 4. Updated Subtask "Specific Person" Input

**File**: `public/app.js`

**Location**: `addAction()` function, subtask section (lines ~3223-3229)

**Changes**:
Changed the "Specific person" input from text field to user dropdown in the subtask creation form.

**Before**:
```html
<div class="form-group assignee-static-group" style="display: none;">
    <label>Person Name</label>
    <input type="text" class="assignee-static" placeholder="Enter person name">
</div>
```

**After**:
```html
<div class="form-group assignee-static-group" style="display: none;">
    <label>Person Name</label>
    <select class="assignee-static">
        <option value="">-- Select user --</option>
        ${allUsers.map(user => `<option value="${user.name}">${user.name}</option>`).join('')}
    </select>
</div>
```

---

## How It Works

### User Flow - Set Field Action

1. User clicks "Add Action" → "Set Field"
2. User selects a field from the dropdown
3. **If field is `fulfillment_ops` or `sales_team`**:
   - Value input automatically changes to a user dropdown
   - Dropdown is populated with all active users from the database
4. **If field is anything else** (status, auto_approved, etc.):
   - Value input remains a text field
5. User selects a user from dropdown (or types value in text field)
6. Saves automation

### User Flow - Create Subtask Action

1. User clicks "Add Action" → "Create Subtask"
2. User selects "Assign To" type
3. **If "Use client field"**:
   - Shows dropdown with `sales_team` or `fulfillment_ops`
4. **If "Specific person"**:
   - Shows user dropdown (NEW!)
   - Previously was a text input
5. User selects a user from dropdown
6. Saves automation

### Editing Existing Automations

1. User clicks "Edit" on an existing automation
2. Modal opens and loads automation data
3. For each "Set Field" action:
   - Sets the field value
   - Calls `updateActionValueInput()` to show correct input type
   - Sets the value in the appropriate input (dropdown or text)
4. User sees the correct input type immediately

---

## Data Source

**User List**: Fetched from `/api/users/all` endpoint

**Stored In**: `allUsers` global variable (array)

**Structure**:
```javascript
[
  {
    id: 1,
    name: "Ian",
    email: "ian@example.com",
    role: "admin",
    picture: "..."
  },
  // ... more users
]
```

**When Loaded**: On page load when user logs in

---

## Benefits

✅ **Better UX**: No more typos when entering user names

✅ **Consistency**: Only valid users from the database can be selected

✅ **Validation**: Can't accidentally assign to non-existent users

✅ **Discoverability**: Users can see all available assignees

✅ **Efficiency**: Faster to select than to type

---

## Examples

### Example 1: Creating "Auto-assign Ian" Automation

**Before**:
1. Add Action → Set Field
2. Field: `fulfillment_ops`
3. Value: Type "Ian" (could mistype as "Lan", "Iam", etc.)

**After**:
1. Add Action → Set Field
2. Field: `fulfillment_ops` → **Input changes to dropdown automatically**
3. Value: Select "Ian" from dropdown ✅

---

### Example 2: Creating Subtask with Specific Assignee

**Before**:
1. Add Action → Create Subtask
2. Assign To: "Specific person"
3. Person Name: Type "John" (could mistype)

**After**:
1. Add Action → Create Subtask
2. Assign To: "Specific person"
3. Person Name: Select "John" from dropdown ✅

---

### Example 3: Editing Existing Automation

**Scenario**: Edit the "Auto-assign Ian" automation

**Before**:
- Opens with text input showing "Ian"
- User has to know valid names

**After**:
- Opens with dropdown showing "Ian" selected ✅
- Can easily change to another user from the list

---

## Testing Checklist

### Create New Automation

- [ ] Create "Set Field" action
- [ ] Select `fulfillment_ops` field → Verify dropdown appears
- [ ] Select user from dropdown → Verify it saves correctly
- [ ] Select `sales_team` field → Verify dropdown appears
- [ ] Select user from dropdown → Verify it saves correctly
- [ ] Select `status` field → Verify text input appears
- [ ] Type status value → Verify it saves correctly

### Edit Existing Automation

- [ ] Open existing automation with `fulfillment_ops = "Ian"`
- [ ] Verify dropdown is shown (not text input)
- [ ] Verify "Ian" is pre-selected in dropdown
- [ ] Change to different user → Save → Verify it saves

### Create Subtask

- [ ] Create "Create Subtask" action
- [ ] Select "Specific person" → Verify dropdown appears
- [ ] Select user → Verify it saves correctly

### Edge Cases

- [ ] No users in database → Dropdown shows empty
- [ ] User deleted from database → Existing automation shows deleted user's name
- [ ] Switch between fields → Input type changes correctly

---

## Technical Notes

### Field Detection

User fields are hardcoded in the `updateActionValueInput()` function:

```javascript
const userFields = ['fulfillment_ops', 'sales_team'];
```

**To add more user fields**: Add to this array.

### Data Preservation

When switching between input types (dropdown ↔ text), the current value is preserved:

```javascript
const currentValue = container.querySelector('.action-value')?.value || '';
```

### Global State Dependency

The feature relies on `allUsers` being populated:

```javascript
allUsers.map(user => `<option value="${user.name}">...`)
```

If `allUsers` is empty, the dropdown will only show "-- Select user --".

---

## Future Enhancements

### Possible Improvements:

1. **Search in Dropdown**: Add autocomplete/search for large user lists
2. **User Avatars**: Show user pictures in dropdown options
3. **Role Filtering**: Filter users by role (e.g., only show Sales users for sales_team field)
4. **Grouped Dropdowns**: Group users by department/role
5. **Create New User**: Add "+ Create new user" option in dropdown

---

## Rollback Instructions

If you need to revert these changes:

1. **Remove the `onchange` handler**:
   ```html
   <select class="action-field" onchange="updateActionValueInput(this)">
   ```
   Change to:
   ```html
   <select class="action-field">
   ```

2. **Remove the container wrapper**:
   ```html
   <div class="action-value-container">
       <input type="text" class="action-value" placeholder="Enter value">
   </div>
   ```
   Change to:
   ```html
   <input type="text" class="action-value" placeholder="Enter value">
   ```

3. **Delete the `updateActionValueInput()` function** (lines ~3240-3271)

4. **Revert `editAutomation()` changes** (lines ~2943-2950) back to original

5. **Revert subtask assignee input** back to text field

---

## Support

If you encounter issues:

1. **Dropdown not appearing**: Check if `allUsers` is populated
   - Open browser console
   - Type: `allUsers`
   - Should show array of user objects

2. **Dropdown empty**: Check API endpoint
   - Open Network tab in DevTools
   - Look for `/api/users/all` request
   - Verify it returns users

3. **Values not saving**: Check browser console for errors

4. **Old automations broken**: Run database check
   ```bash
   node check-ian-automation.js
   ```

---

**Last Updated**: 2025-01-04
**Feature Status**: ✅ Implemented and Ready
