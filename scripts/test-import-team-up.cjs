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

// Get card name function
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

// Test importing both Team Up decklists
console.log('Testing PTCGO Import for Torrential Cannon and Relentless Flame\n');
console.log('='.repeat(70));

// Test Torrential Cannon
console.log('\n📋 Testing Torrential Cannon deck...\n');
const torrentialPath = path.join(__dirname, '../decklists/torrential-cannon.txt');
const torrentialText = fs.readFileSync(torrentialPath, 'utf-8');
const torrentialCards = importFromPTCGO(torrentialText, cardsMap);

console.log(`✓ Successfully imported ${Object.keys(torrentialCards).length} unique cards`);
let totalTorrential = 0;
for (const qty of Object.values(torrentialCards)) {
  totalTorrential += qty;
}
console.log(`✓ Total cards in deck: ${totalTorrential}`);

// Show first few cards as sample
console.log('\nSample cards:');
let count = 0;
for (const [cardId, qty] of Object.entries(torrentialCards)) {
  if (count >= 5) break;
  const card = cardsMap.get(cardId);
  if (card) {
    console.log(`  ${qty}x ${getCardName(card)} (${card.set} ${card.number})`);
  }
  count++;
}

console.log('\n' + '='.repeat(70));

// Test Relentless Flame
console.log('\n📋 Testing Relentless Flame deck...\n');
const relentlessPath = path.join(__dirname, '../decklists/relentless-flame.txt');
const relentlessText = fs.readFileSync(relentlessPath, 'utf-8');
const relentlessCards = importFromPTCGO(relentlessText, cardsMap);

console.log(`✓ Successfully imported ${Object.keys(relentlessCards).length} unique cards`);
let totalRelentless = 0;
for (const qty of Object.values(relentlessCards)) {
  totalRelentless += qty;
}
console.log(`✓ Total cards in deck: ${totalRelentless}`);

// Show first few cards as sample
console.log('\nSample cards:');
count = 0;
for (const [cardId, qty] of Object.entries(relentlessCards)) {
  if (count >= 5) break;
  const card = cardsMap.get(cardId);
  if (card) {
    console.log(`  ${qty}x ${getCardName(card)} (${card.set} ${card.number})`);
  }
  count++;
}

console.log('\n' + '='.repeat(70));
console.log('\n✅ Import test complete!\n');
