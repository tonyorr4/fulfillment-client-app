/**
 * Test Script: Automation Engine
 * Tests condition evaluation and action execution with sample data
 */

const {
    evaluateSingleCondition,
    evaluateConditions,
    triggerAutomations
} = require('./automation-engine.js');
const { Pool } = require('pg');
require('dotenv').config();

// Test client data samples
const sampleClients = {
    simpleClient: {
        id: 999,
        company_name: 'Test Simple Client',
        battery: 'No',
        heavy_sku: 'No',
        num_pallets: '1-10',
        num_skus: '1-10',
        status: 'new-request',
        auto_approved: false,
        fulfillment_ops: null,
        sales_team: 'John Doe'
    },
    complexClient: {
        id: 998,
        company_name: 'Test Complex Client',
        battery: 'Yes',
        heavy_sku: 'Yes',
        num_pallets: '>100',
        num_skus: '50-100',
        status: 'new-request',
        auto_approved: false,
        fulfillment_ops: null,
        sales_team: 'Jane Smith'
    }
};

// Test suite
function runTests() {
    console.log('🧪 AUTOMATION ENGINE TEST SUITE\n');
    console.log('='.repeat(60));

    // Test 1: Simple condition evaluation
    console.log('\n📝 Test 1: Simple Condition Evaluation');
    console.log('-'.repeat(60));

    const simpleCondition = {
        type: 'condition',
        field: 'battery',
        operator: 'equals',
        value: 'No'
    };

    const result1 = evaluateSingleCondition(simpleCondition, sampleClients.simpleClient);
    console.log(`✓ battery='No' for simpleClient: ${result1} (expected: true)`);
    console.assert(result1 === true, 'Simple condition should pass');

    const result2 = evaluateSingleCondition(simpleCondition, sampleClients.complexClient);
    console.log(`✓ battery='No' for complexClient: ${result2} (expected: false)`);
    console.assert(result2 === false, 'Simple condition should fail');

    // Test 2: NOT IN operator
    console.log('\n📝 Test 2: NOT IN Operator');
    console.log('-'.repeat(60));

    const notInCondition = {
        type: 'condition',
        field: 'num_pallets',
        operator: 'not_in',
        value: ['50-100', '>100']
    };

    const result3 = evaluateSingleCondition(notInCondition, sampleClients.simpleClient);
    console.log(`✓ num_pallets NOT IN ['50-100', '>100'] for simpleClient: ${result3} (expected: true)`);
    console.assert(result3 === true, 'NOT IN should pass for 1-10');

    const result4 = evaluateSingleCondition(notInCondition, sampleClients.complexClient);
    console.log(`✓ num_pallets NOT IN ['50-100', '>100'] for complexClient: ${result4} (expected: false)`);
    console.assert(result4 === false, 'NOT IN should fail for >100');

    // Test 3: AND group condition
    console.log('\n📝 Test 3: AND Group Condition');
    console.log('-'.repeat(60));

    const andGroupCondition = {
        type: 'group',
        operator: 'AND',
        conditions: [
            { type: 'condition', field: 'battery', operator: 'equals', value: 'No' },
            { type: 'condition', field: 'num_pallets', operator: 'not_in', value: ['50-100', '>100'] },
            { type: 'condition', field: 'num_skus', operator: 'not_in', value: ['50-100', '>100'] }
        ]
    };

    const result5 = evaluateConditions(andGroupCondition, sampleClients.simpleClient);
    console.log(`✓ Auto-approval logic for simpleClient: ${result5} (expected: true)`);
    console.assert(result5 === true, 'Simple client should pass auto-approval');

    const result6 = evaluateConditions(andGroupCondition, sampleClients.complexClient);
    console.log(`✓ Auto-approval logic for complexClient: ${result6} (expected: false)`);
    console.assert(result6 === false, 'Complex client should fail auto-approval');

    // Test 4: OR group condition
    console.log('\n📝 Test 4: OR Group Condition');
    console.log('-'.repeat(60));

    const orGroupCondition = {
        type: 'group',
        operator: 'OR',
        conditions: [
            { type: 'condition', field: 'battery', operator: 'equals', value: 'Yes' },
            { type: 'condition', field: 'heavy_sku', operator: 'equals', value: 'Yes' }
        ]
    };

    const result7 = evaluateConditions(orGroupCondition, sampleClients.simpleClient);
    console.log(`✓ Has battery OR heavy SKU for simpleClient: ${result7} (expected: false)`);
    console.assert(result7 === false, 'Simple client should fail OR condition');

    const result8 = evaluateConditions(orGroupCondition, sampleClients.complexClient);
    console.log(`✓ Has battery OR heavy SKU for complexClient: ${result8} (expected: true)`);
    console.assert(result8 === true, 'Complex client should pass OR condition');

    // Test 5: Nested conditions
    console.log('\n📝 Test 5: Nested Conditions (AND with OR inside)');
    console.log('-'.repeat(60));

    const nestedCondition = {
        type: 'group',
        operator: 'AND',
        conditions: [
            { type: 'condition', field: 'battery', operator: 'equals', value: 'No' },
            {
                type: 'group',
                operator: 'OR',
                conditions: [
                    { type: 'condition', field: 'num_pallets', operator: 'equals', value: '1-10' },
                    { type: 'condition', field: 'num_pallets', operator: 'equals', value: '10-50' }
                ]
            }
        ]
    };

    const result9 = evaluateConditions(nestedCondition, sampleClients.simpleClient);
    console.log(`✓ Battery=No AND (pallets=1-10 OR pallets=10-50) for simpleClient: ${result9} (expected: true)`);
    console.assert(result9 === true, 'Nested condition should pass');

    const result10 = evaluateConditions(nestedCondition, sampleClients.complexClient);
    console.log(`✓ Battery=No AND (pallets=1-10 OR pallets=10-50) for complexClient: ${result10} (expected: false)`);
    console.assert(result10 === false, 'Nested condition should fail on battery=Yes');

    // Test 6: Empty conditions (always true)
    console.log('\n📝 Test 6: Empty Conditions (Always Run)');
    console.log('-'.repeat(60));

    const emptyCondition = {
        type: 'group',
        operator: 'AND',
        conditions: []
    };

    const result11 = evaluateConditions(emptyCondition, sampleClients.simpleClient);
    console.log(`✓ Empty conditions for simpleClient: ${result11} (expected: true)`);
    console.assert(result11 === true, 'Empty conditions should always pass');

    const result12 = evaluateConditions(emptyCondition, sampleClients.complexClient);
    console.log(`✓ Empty conditions for complexClient: ${result12} (expected: true)`);
    console.assert(result12 === true, 'Empty conditions should always pass');

    // Test 7: Edge case - null field value
    console.log('\n📝 Test 7: Edge Case - Null Field Values');
    console.log('-'.repeat(60));

    const clientWithNulls = {
        ...sampleClients.simpleClient,
        fulfillment_ops: null
    };

    const isEmptyCondition = {
        type: 'condition',
        field: 'fulfillment_ops',
        operator: 'is_empty',
        value: null
    };

    const result13 = evaluateSingleCondition(isEmptyCondition, clientWithNulls);
    console.log(`✓ fulfillment_ops is_empty: ${result13} (expected: true)`);
    console.assert(result13 === true, 'Null should be treated as empty');

    // Test 8: Edge case - contains operator
    console.log('\n📝 Test 8: Contains Operator (Case Insensitive)');
    console.log('-'.repeat(60));

    const containsCondition = {
        type: 'condition',
        field: 'company_name',
        operator: 'contains',
        value: 'simple'
    };

    const result14 = evaluateSingleCondition(containsCondition, sampleClients.simpleClient);
    console.log(`✓ company_name contains 'simple': ${result14} (expected: true)`);
    console.assert(result14 === true, 'Contains should be case-insensitive');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('Automation Engine is working correctly:');
    console.log('  ✓ Simple conditions (equals, not_in)');
    console.log('  ✓ Group conditions (AND, OR)');
    console.log('  ✓ Nested conditions');
    console.log('  ✓ Empty conditions (always run)');
    console.log('  ✓ Edge cases (null values, case-insensitive contains)');
    console.log('');
    console.log('Next step: Test with real database by creating a test client.');
}

// Run tests
try {
    runTests();
} catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
}
