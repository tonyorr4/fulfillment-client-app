/**
 * Automation Engine
 * Core logic for evaluating conditions and executing actions
 */

const { Pool } = require('pg');

/**
 * Evaluates a single condition against client data
 * @param {Object} condition - Condition object with field, operator, value
 * @param {Object} clientData - Client record data
 * @returns {boolean} - Whether condition is met
 */
function evaluateSingleCondition(condition, clientData) {
    const { field, operator, value } = condition;
    const fieldValue = clientData[field];

    // Handle null/undefined field values
    if (fieldValue === null || fieldValue === undefined) {
        if (operator === 'is_empty') return true;
        if (operator === 'is_not_empty') return false;
        return false; // Most operators fail on null/undefined
    }

    switch (operator) {
        case 'equals':
            return fieldValue === value;

        case 'not_equals':
            return fieldValue !== value;

        case 'greater_than':
            return Number(fieldValue) > Number(value);

        case 'less_than':
            return Number(fieldValue) < Number(value);

        case 'greater_or_equal':
            return Number(fieldValue) >= Number(value);

        case 'less_or_equal':
            return Number(fieldValue) <= Number(value);

        case 'contains':
            return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());

        case 'not_contains':
            return !String(fieldValue).toLowerCase().includes(String(value).toLowerCase());

        case 'in':
            // value should be an array
            return Array.isArray(value) && value.includes(fieldValue);

        case 'not_in':
            // value should be an array
            return Array.isArray(value) && !value.includes(fieldValue);

        case 'is_empty':
            return !fieldValue || String(fieldValue).trim() === '';

        case 'is_not_empty':
            return fieldValue && String(fieldValue).trim() !== '';

        case 'is_true':
            return fieldValue === true || fieldValue === 'true' || fieldValue === 1;

        case 'is_false':
            return fieldValue === false || fieldValue === 'false' || fieldValue === 0;

        default:
            console.warn(`Unknown operator: ${operator}`);
            return false;
    }
}

/**
 * Recursively evaluates a condition tree (supports nested groups)
 * @param {Object} conditions - Condition object or group
 * @param {Object} clientData - Client record data
 * @returns {boolean} - Whether conditions are met
 */
function evaluateConditions(conditions, clientData) {
    // Handle empty conditions (always true)
    if (!conditions || (conditions.type === 'group' && conditions.conditions.length === 0)) {
        return true;
    }

    // Single condition
    if (conditions.type === 'condition') {
        return evaluateSingleCondition(conditions, clientData);
    }

    // Condition group (AND/OR logic)
    if (conditions.type === 'group') {
        const results = conditions.conditions.map(c =>
            evaluateConditions(c, clientData)
        );

        if (conditions.operator === 'AND') {
            return results.every(r => r === true);
        } else if (conditions.operator === 'OR') {
            return results.some(r => r === true);
        } else {
            console.warn(`Unknown group operator: ${conditions.operator}`);
            return false;
        }
    }

    console.warn(`Unknown condition type: ${conditions.type}`);
    return false;
}

/**
 * Sets a client field to a specific value
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {number} clientId - Client ID
 * @param {string} field - Field name
 * @param {any} value - New value
 * @param {number} userId - User ID (for audit trail)
 * @param {string} automationName - Name of automation (for audit trail)
 */
async function setClientField(pool, clientId, field, value, userId = null, automationName = null) {
    // Whitelist of fields that can be updated by automations
    const allowedFields = [
        'status',
        'client_approved',
        'auto_approved',
        'fulfillment_ops',
        'sales_team',
        'heavy_sku',
        'special_packaging',
        'barcoding'
    ];

    if (!allowedFields.includes(field)) {
        throw new Error(`Field "${field}" is not allowed to be updated by automations`);
    }

    // Update the field
    await pool.query(
        `UPDATE clients SET ${field} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [value, clientId]
    );

    // Log in activity_log for audit trail
    await pool.query(
        `INSERT INTO activity_log (client_id, user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [
            clientId,
            userId,
            'automation_field_update',
            JSON.stringify({
                automation_name: automationName,
                field: field,
                new_value: value
            })
        ]
    );
}

/**
 * Sets multiple client fields at once
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {number} clientId - Client ID
 * @param {Object} fields - Object with field: value pairs
 * @param {number} userId - User ID (for audit trail)
 * @param {string} automationName - Name of automation (for audit trail)
 */
async function setMultipleFields(pool, clientId, fields, userId = null, automationName = null) {
    for (const [field, value] of Object.entries(fields)) {
        await setClientField(pool, clientId, field, value, userId, automationName);
    }
}

/**
 * Creates a subtask for a client
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {number} clientId - Client ID
 * @param {string} text - Subtask text
 * @param {string} assignee - Assignee name
 * @param {boolean} markAutoCreated - Whether to mark as auto_created
 */
async function createSubtask(pool, clientId, text, assignee, markAutoCreated = true) {
    await pool.query(
        `INSERT INTO subtasks (client_id, subtask_text, assignee, auto_created, created_by)
         VALUES ($1, $2, $3, $4, NULL)`,
        [clientId, text, assignee, markAutoCreated]
    );
}

/**
 * Executes an array of actions for a client
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {Array} actions - Array of action objects
 * @param {number} clientId - Client ID
 * @param {Object} clientData - Full client data (for dynamic assignee fields)
 * @param {number} userId - User ID (for audit trail)
 * @param {string} automationName - Name of automation (for audit trail)
 * @returns {Array} - Array of executed actions with results
 */
async function executeActions(pool, actions, clientId, clientData, userId = null, automationName = null) {
    const results = [];

    for (const action of actions) {
        try {
            if (action.type === 'set_field') {
                await setClientField(pool, clientId, action.field, action.value, userId, automationName);
                results.push({
                    action: 'set_field',
                    field: action.field,
                    value: action.value,
                    success: true
                });
            }

            else if (action.type === 'set_multiple_fields') {
                await setMultipleFields(pool, clientId, action.fields, userId, automationName);
                results.push({
                    action: 'set_multiple_fields',
                    fields: action.fields,
                    success: true
                });
            }

            else if (action.type === 'create_subtask') {
                // Determine assignee (from client field or static value)
                let assignee = null;
                if (action.assignee_field) {
                    assignee = clientData[action.assignee_field];
                } else if (action.assignee_static) {
                    assignee = action.assignee_static;
                }

                if (!assignee) {
                    console.warn(`Subtask "${action.text}" has no assignee (field: ${action.assignee_field})`);
                }

                await createSubtask(
                    pool,
                    clientId,
                    action.text,
                    assignee,
                    action.mark_auto_created !== false // Default to true
                );

                results.push({
                    action: 'create_subtask',
                    text: action.text,
                    assignee: assignee,
                    success: true
                });
            }

            else {
                console.warn(`Unknown action type: ${action.type}`);
                results.push({
                    action: action.type,
                    success: false,
                    error: 'Unknown action type'
                });
            }
        } catch (error) {
            console.error(`Action execution failed:`, error);
            results.push({
                action: action.type,
                success: false,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * Logs an automation execution to automation_logs table
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {number} automationId - Automation ID
 * @param {number} clientId - Client ID
 * @param {string} triggerEvent - Trigger event name
 * @param {boolean} conditionsMet - Whether conditions were met
 * @param {Array} actionsExecuted - Array of executed actions
 * @param {string} errorMessage - Error message if any
 * @param {number} executionTimeMs - Execution time in milliseconds
 */
async function logAutomationExecution(
    pool,
    automationId,
    clientId,
    triggerEvent,
    conditionsMet,
    actionsExecuted,
    errorMessage = null,
    executionTimeMs = 0
) {
    await pool.query(
        `INSERT INTO automation_logs
         (automation_id, client_id, trigger_event, conditions_met,
          actions_executed, error_message, execution_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            automationId,
            clientId,
            triggerEvent,
            conditionsMet,
            JSON.stringify(actionsExecuted),
            errorMessage,
            executionTimeMs
        ]
    );
}

/**
 * Main function: Triggers all automations for a given event
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {string} event - Trigger event (client_created, status_changed, etc.)
 * @param {number} clientId - Client ID
 * @param {Object} clientData - Full client data
 * @param {number} userId - User ID (for audit trail)
 * @returns {Object} - Summary of automation execution
 */
async function triggerAutomations(pool, event, clientId, clientData, userId = null) {
    const startTime = Date.now();
    const summary = {
        event: event,
        clientId: clientId,
        automationsTriggered: 0,
        automationsExecuted: 0,
        totalActions: 0,
        errors: []
    };

    try {
        // Get all enabled automations for this trigger, ordered by execution_order
        const result = await pool.query(
            `SELECT * FROM automations
             WHERE trigger_event = $1 AND enabled = true
             ORDER BY execution_order ASC, id ASC`,
            [event]
        );

        const automations = result.rows;
        summary.automationsTriggered = automations.length;

        for (const automation of automations) {
            const automationStartTime = Date.now();
            let conditionsMet = false;
            let actionsExecuted = [];
            let errorMessage = null;

            try {
                // Evaluate conditions
                conditionsMet = evaluateConditions(automation.conditions, clientData);

                // Execute actions if conditions met
                if (conditionsMet) {
                    actionsExecuted = await executeActions(
                        pool,
                        automation.actions,
                        clientId,
                        clientData,
                        userId,
                        automation.name
                    );
                    summary.automationsExecuted++;
                    summary.totalActions += actionsExecuted.length;
                }
            } catch (error) {
                errorMessage = error.message;
                console.error(`Automation ${automation.id} ("${automation.name}") failed:`, error);
                summary.errors.push({
                    automationId: automation.id,
                    automationName: automation.name,
                    error: error.message
                });
            }

            // Log execution (continue even if automation failed)
            try {
                await logAutomationExecution(
                    pool,
                    automation.id,
                    clientId,
                    event,
                    conditionsMet,
                    actionsExecuted,
                    errorMessage,
                    Date.now() - automationStartTime
                );
            } catch (logError) {
                console.error(`Failed to log automation execution:`, logError);
            }
        }
    } catch (error) {
        console.error(`Failed to trigger automations for event "${event}":`, error);
        summary.errors.push({
            automationId: null,
            automationName: 'System',
            error: error.message
        });
    }

    summary.totalExecutionTime = Date.now() - startTime;
    return summary;
}

module.exports = {
    evaluateSingleCondition,
    evaluateConditions,
    setClientField,
    setMultipleFields,
    createSubtask,
    executeActions,
    logAutomationExecution,
    triggerAutomations
};
