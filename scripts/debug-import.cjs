#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load card database
const cardsPath = path.join(__dirname, '../dist/cards-western.json');
const cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'));

// Build Map<string, Card>
const cardsMap = new Map();
for (const card of cardsData) {
  cardsMap.set(card.id, card);
}

console.log('Total cards in database:', cardsMap.size);

// Build lookup by name|ptcgoCode|number
const cardsByNamePtcgoNumber = new Map();

for (const card of cardsMap.values()) {
  const name = (card.names?.en || '').toLowerCase();
  const ptcgoCode = (card.ptcgoCode || '').toLowerCase();

  if (name && ptcgoCode && card.number) {
    const key = `${name}|${ptcgoCode}|${card.number}`;
    cardsByNamePtcgoNumber.set(key, card);
  }
}

console.log('Total lookup entries:', cardsByNamePtcgoNumber.size);
console.log();

// Test specific lookups
const testCases = [
  { name: 'xatu', ptcgoCode: 'sk', number: '35' },
  { name: 'natu', ptcgoCode: 'sk', number: '80' },
  { name: 'psychic energy', ptcgoCode: 'sum', number: '168' },
  { name: 'flareon', ptcgoCode: 'sk', number: '8' },
];

console.log('Testing lookups:');
for (const test of testCases) {
  const key = `${test.name}|${test.ptcgoCode}|${test.number}`;
  const found = cardsByNamePtcgoNumber.get(key);

  if (found) {
    console.log(`✓ ${key} => ${found.id}`);
  } else {
    console.log(`✗ ${key} => NOT FOUND`);

    // Try to find similar keys
    console.log('  Similar keys in map:');
    let count = 0;
    for (const [mapKey, card] of cardsByNamePtcgoNumber.entries()) {
      if (mapKey.includes(test.name) && mapKey.includes(test.ptcgoCode)) {
        console.log(`    ${mapKey}`);
        count++;
        if (count >= 3) break;
      }
    }
  }
}
