// Simple test file to verify collection store functionality
// Run this in the browser console or Node environment

import { collection, totalCards } from './collection';
import { get } from 'svelte/store';

console.log('Testing Collection Store...\n');

// Test 1: Initial state
console.log('Test 1: Initial state');
collection.reset();
console.assert(get(totalCards) === 0, 'Total cards should be 0');
console.assert(collection.getQuantity('test-1') === 0, 'New card quantity should be 0');
console.log('✓ Initial state correct\n');

// Test 2: Increment card
console.log('Test 2: Increment card');
let result = collection.increment('test-1');
console.assert(result.success === true, 'Increment should succeed');
console.assert(result.quantity === 1, 'Quantity should be 1');
console.assert(collection.getQuantity('test-1') === 1, 'getQuantity should return 1');
console.assert(get(totalCards) === 1, 'Total cards should be 1');
console.log('✓ Increment works\n');

// Test 3: Multiple increments
console.log('Test 3: Multiple increments');
collection.increment('test-1');
collection.increment('test-1');
console.assert(collection.getQuantity('test-1') === 3, 'Quantity should be 3');
console.assert(get(totalCards) === 3, 'Total cards should be 3');
console.log('✓ Multiple increments work\n');

// Test 4: Decrement card
console.log('Test 4: Decrement card');
result = collection.decrement('test-1');
console.assert(result.success === true, 'Decrement should succeed');
console.assert(result.quantity === 2, 'Quantity should be 2');
console.assert(collection.getQuantity('test-1') === 2, 'getQuantity should return 2');
console.log('✓ Decrement works\n');

// Test 5: Decrement to zero (should remove from collection)
console.log('Test 5: Decrement to zero');
collection.decrement('test-1');
collection.decrement('test-1');
console.assert(collection.getQuantity('test-1') === 0, 'Quantity should be 0');
const exported = collection.exportData();
console.assert(!('test-1' in exported), 'Card should be removed from collection');
console.log('✓ Decrement to zero removes card\n');

// Test 6: Decrement at zero (should fail)
console.log('Test 6: Decrement at zero');
result = collection.decrement('test-1');
console.assert(result.success === false, 'Decrement should fail');
console.assert(result.error === 'ALREADY_ZERO', 'Error should be ALREADY_ZERO');
console.assert(result.quantity === 0, 'Quantity should remain 0');
console.log('✓ Decrement at zero fails correctly\n');

// Test 7: Max quantity (99)
console.log('Test 7: Max quantity');
collection.reset();
for (let i = 0; i < 99; i++) {
  collection.increment('test-max');
}
console.assert(collection.getQuantity('test-max') === 99, 'Quantity should be 99');
result = collection.increment('test-max');
console.assert(result.success === false, 'Increment should fail at max');
console.assert(result.error === 'MAX_QUANTITY', 'Error should be MAX_QUANTITY');
console.assert(result.quantity === 99, 'Quantity should remain 99');
console.assert(collection.getQuantity('test-max') === 99, 'Quantity should still be 99');
console.log('✓ Max quantity enforced\n');

// Test 8: Multiple cards
console.log('Test 8: Multiple cards');
collection.reset();
collection.increment('card-1');
collection.increment('card-1');
collection.increment('card-2');
collection.increment('card-3');
collection.increment('card-3');
collection.increment('card-3');
console.assert(get(totalCards) === 6, 'Total should be 6');
console.assert(collection.getQuantity('card-1') === 2, 'card-1 should be 2');
console.assert(collection.getQuantity('card-2') === 1, 'card-2 should be 1');
console.assert(collection.getQuantity('card-3') === 3, 'card-3 should be 3');
console.log('✓ Multiple cards work\n');

// Test 9: Export data
console.log('Test 9: Export data');
const data = collection.exportData();
console.assert(Object.keys(data).length === 3, 'Should have 3 cards');
console.assert(data['card-1'] === 2, 'card-1 should be 2');
console.assert(data['card-2'] === 1, 'card-2 should be 1');
console.assert(data['card-3'] === 3, 'card-3 should be 3');
console.log('✓ Export works\n');

console.log('All tests passed! ✓');
