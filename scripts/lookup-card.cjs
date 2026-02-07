#!/usr/bin/env node
/**
 * Card lookup utility - find cards in cards-western.json by name and number.
 *
 * Usage:
 *   node scripts/lookup-card.js "Haunter" "027"
 *   node scripts/lookup-card.js "Mega Gengar" "056"
 *   node scripts/lookup-card.js "Darkness Energy"          # name-only search
 *   node scripts/lookup-card.js --set "Phantasmal Flames"  # list all cards in a set
 *   node scripts/lookup-card.js --sets                     # list all set names
 *
 * Output includes: id, name, set, number, series, supertype — everything needed
 * to build a PTCGO-format decklist line: * {qty} {name} {set} {number}
 */

const path = require('path');
const cards = require(path.join(__dirname, '..', 'dist', 'cards-western.json'));

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  node scripts/lookup-card.js "Card Name" ["number"]');
  console.log('  node scripts/lookup-card.js --set "Set Name"');
  console.log('  node scripts/lookup-card.js --sets');
  process.exit(0);
}

// --sets: list all unique set names
if (args[0] === '--sets') {
  const sets = new Map();
  for (const c of cards) {
    if (!sets.has(c.set)) {
      sets.set(c.set, { series: c.series, count: 0 });
    }
    sets.get(c.set).count++;
  }
  const sorted = [...sets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [name, info] of sorted) {
    console.log(`${name} (${info.series}) - ${info.count} cards`);
  }
  process.exit(0);
}

// --set "Name": list all cards in a set
if (args[0] === '--set') {
  const setName = args.slice(1).join(' ').toLowerCase();
  const matches = cards.filter(c => (c.set || '').toLowerCase().includes(setName));
  matches.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  for (const c of matches) {
    console.log(`${c.number} | ${c.names?.en || '?'} | ${c.set} | id:${c.id} | ${c.supertype}`);
  }
  console.log(`\n${matches.length} cards found.`);
  process.exit(0);
}

// Name + optional number search
const nameQuery = args[0].toLowerCase();
const numberQuery = args[1] || null;

const matches = cards.filter(c => {
  const name = (c.names?.en || '').toLowerCase();
  if (!name.includes(nameQuery)) return false;
  if (numberQuery) {
    // Match number with or without leading zeros
    const num = numberQuery.replace(/^0+/, '');
    const cardNum = (c.number || '').replace(/^0+/, '');
    if (cardNum !== num) return false;
  }
  return true;
});

if (matches.length === 0) {
  console.log('No cards found.');
  process.exit(1);
}

for (const c of matches) {
  console.log(`id: ${c.id}`);
  console.log(`  name:   ${c.names?.en || '?'}`);
  console.log(`  set:    ${c.set}`);
  console.log(`  number: ${c.number}`);
  console.log(`  series: ${c.series}`);
  console.log(`  type:   ${c.supertype}`);
  console.log(`  ptcgo:  * 1 ${c.names?.en || '?'} ${c.set} ${c.number}`);
  console.log('');
}
console.log(`${matches.length} match(es).`);
