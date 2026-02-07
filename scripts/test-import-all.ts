#!/usr/bin/env tsx
/**
 * Test importing all theme decklists using the actual importFromPTCGO function
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { importFromPTCGO } from '../src/utils/deckUtils';
import { getCardName } from '../src/utils/cardUtils';
import type { Card } from '../types';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load card database
const cardsPath = path.join(__dirname, '../dist/cards-western.json');
const cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf-8')) as Card[];

// Build Map<string, Card>
const cardsMap = new Map<string, Card>();
for (const card of cardsData) {
  cardsMap.set(card.id, card);
}

console.log('='.repeat(70));
console.log('Testing PTCGO Import for All Theme Decks');
console.log('='.repeat(70));

// Test all decklists
const decklists = [
  'torrential-cannon',
  'relentless-flame',
  'mind-machine',
  'eeveelution'
];

for (const deckName of decklists) {
  console.log(`\n📋 Testing ${deckName}...\n`);

  const deckPath = path.join(__dirname, '../decklists', `${deckName}.txt`);
  const deckText = fs.readFileSync(deckPath, 'utf-8');
  const deckCards = importFromPTCGO(deckText, cardsMap);

  const uniqueCards = Object.keys(deckCards).length;
  const totalCards = Object.values(deckCards).reduce((a, b) => a + b, 0);

  console.log(`✓ Successfully imported ${uniqueCards} unique cards`);
  console.log(`✓ Total cards in deck: ${totalCards}`);

  // Show first few cards as sample
  console.log('\nSample cards:');
  let count = 0;
  for (const [cardId, qty] of Object.entries(deckCards)) {
    if (count >= 5) break;
    const card = cardsMap.get(cardId);
    if (card) {
      console.log(`  ${qty}x ${getCardName(card)} (${card.set} ${card.number})`);
    }
    count++;
  }

  console.log('\n' + '-'.repeat(70));
}

console.log('\n✅ All import tests complete!\n');
