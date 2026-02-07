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

// Simplified getCardName function
function getCardName(card) {
  return card.names?.en || card.name || '';
}

// Enhanced importFromPTCGO function that handles both full set names and ptcgoCodes
function importFromPTCGO(ptcgoText, cards) {
  const result = {};

  // Build set of known set names and ptcgoCodes (lowercase for matching)
  const knownSets = new Set();
  const knownPtcgoCodes = new Set();
  for (const card of cards.values()) {
    if (card.set) knownSets.add(card.set.toLowerCase());
    if (card.ptcgoCode) knownPtcgoCodes.add(card.ptcgoCode.toLowerCase());
  }

  // Build lookup by name|set|number (for full set names)
  const cardsByNameSetNumber = new Map();
  // Build lookup by name|ptcgoCode|number
  const cardsByNamePtcgoNumber = new Map();

  for (const card of cards.values()) {
    const name = getCardName(card).toLowerCase();
    const set = (card.set || '').toLowerCase();
    const ptcgoCode = (card.ptcgoCode || '').toLowerCase();

    // Add both lookups
    if (set) {
      const key = `${name}|${set}|${card.number}`;
      cardsByNameSetNumber.set(key, card);
    }
    if (ptcgoCode) {
      const key = `${name}|${ptcgoCode}|${card.number}`;
      cardsByNamePtcgoNumber.set(key, card);
    }
  }

  for (const line of ptcgoText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    // Match: * {qty} {rest...} {number}
    const match = trimmed.match(/^\*\s+(\d+)\s+(.+)\s+([A-Za-z0-9-]+)$/);
    if (!match) {
      // Silently skip non-card lines
      continue;
    }

    const [, qtyStr, middle, cardNumber] = match;
    const quantity = parseInt(qtyStr, 10);
    if (quantity <= 0) continue;

    // Try to find a known set name or ptcgoCode in 'middle' (from the end)
    let foundCard;
    const middleLower = middle.toLowerCase();

    // Try full set names first
    for (const setName of knownSets) {
      if (middleLower.endsWith(setName)) {
        const cardName = middle.slice(0, -(setName.length)).trim();
        const key = `${cardName.toLowerCase()}|${setName}|${cardNumber}`;
        const card = cardsByNameSetNumber.get(key);
        if (card) {
          foundCard = card;
          break;
        }
      }
    }

    // If not found, try ptcgoCodes
    if (!foundCard) {
      for (const ptcgoCode of knownPtcgoCodes) {
        if (middleLower.endsWith(ptcgoCode)) {
          const cardName = middle.slice(0, -(ptcgoCode.length)).trim();
          const key = `${cardName.toLowerCase()}|${ptcgoCode}|${cardNumber}`;
          const card = cardsByNamePtcgoNumber.get(key);
          if (card) {
            foundCard = card;
            break;
          }
        }
      }
    }

    if (foundCard) {
      result[foundCard.id] = quantity;
    } else {
      console.warn(`⚠️  Card not found: ${middle} ${cardNumber}`);
    }
  }

  return result;
}

// Test importing both decklists
console.log('Testing PTCGO Import for Mind Machine and Eeveelution\n');
console.log('='.repeat(70));

// Test Mind Machine
console.log('\n📋 Testing Mind Machine deck...\n');

// Debug: Check if we can find a specific card manually
const testCard = cardsMap.get('ecard3-35');
if (testCard) {
  console.log('Debug: Found test card in map:', testCard.names.en, testCard.ptcgoCode, testCard.number);
} else {
  console.log('Debug: Test card not found in map');
}

const mindMachinePath = path.join(__dirname, '../decklists/mind-machine.txt');
const mindMachineText = fs.readFileSync(mindMachinePath, 'utf-8');
console.log('Debug: First few lines of decklist:');
console.log(mindMachineText.split('\n').slice(0, 10).join('\n'));
console.log();

const mindMachineCards = importFromPTCGO(mindMachineText, cardsMap);

console.log(`✓ Successfully imported ${Object.keys(mindMachineCards).length} unique cards`);
let totalMindMachine = 0;
for (const qty of Object.values(mindMachineCards)) {
  totalMindMachine += qty;
}
console.log(`✓ Total cards in deck: ${totalMindMachine}`);

// Show first few cards as sample
console.log('\nSample cards:');
let count = 0;
for (const [cardId, qty] of Object.entries(mindMachineCards)) {
  if (count >= 5) break;
  const card = cardsMap.get(cardId);
  if (card) {
    console.log(`  ${qty}x ${getCardName(card)} (${card.set} ${card.number})`);
  }
  count++;
}

console.log('\n' + '='.repeat(70));

// Test Eeveelution
console.log('\n📋 Testing Eeveelution deck...\n');
const eeveelutionPath = path.join(__dirname, '../decklists/eeveelution.txt');
const eeveelutionText = fs.readFileSync(eeveelutionPath, 'utf-8');
const eeveelutionCards = importFromPTCGO(eeveelutionText, cardsMap);

console.log(`✓ Successfully imported ${Object.keys(eeveelutionCards).length} unique cards`);
let totalEeveelution = 0;
for (const qty of Object.values(eeveelutionCards)) {
  totalEeveelution += qty;
}
console.log(`✓ Total cards in deck: ${totalEeveelution}`);

// Show first few cards as sample
console.log('\nSample cards:');
count = 0;
for (const [cardId, qty] of Object.entries(eeveelutionCards)) {
  if (count >= 5) break;
  const card = cardsMap.get(cardId);
  if (card) {
    console.log(`  ${qty}x ${getCardName(card)} (${card.set} ${card.number})`);
  }
  count++;
}

console.log('\n' + '='.repeat(70));
console.log('\n✅ Import test complete!\n');
