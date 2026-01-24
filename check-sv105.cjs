const cards = require('./public/cards-western.json');

// Find all sv10.5 related cards
const sv10Cards = cards.filter(c => c.id.includes('sv10.5') || c.id.includes('sv10pt5'));

// Get unique sets
const sets = new Set(sv10Cards.map(c => c.set));
console.log('Sets found:');
sets.forEach(s => console.log('  -', s));

// Analyze set ID patterns
console.log('\nSet ID patterns:');
const idPrefixes = new Map();
sv10Cards.forEach(c => {
  const setId = c.id.split('-')[0];
  if (!idPrefixes.has(setId)) {
    idPrefixes.set(setId, {set: c.set, count: 0});
  }
  idPrefixes.get(setId).count++;
});

Array.from(idPrefixes.entries()).forEach(([id, info]) =>
  console.log(`  ${id}: ${info.set} (${info.count} cards)`)
);
