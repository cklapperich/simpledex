const cards = require('./public/cards-western.json');

// Find all SWSH006 cards
const swsh006 = cards.filter(c => c.number === 'SWSH006' || c.id.includes('SWSH006'));
console.log('All cards with SWSH006:', swsh006.length);
swsh006.forEach(c => {
  console.log(`  - ${c.id}: ${c.names.en} (set: ${c.setId}, supertype: ${c.supertype})`);
  console.log(`    Attacks: ${c.attacks?.length || 0}, Abilities: ${c.abilities?.length || 0}`);
});

// Find Rillaboom by name
const rillaboom = cards.filter(c => c.names.en.includes('Rillaboom') && c.number === 'SWSH006');
console.log('\nRillaboom cards with SWSH006:', rillaboom.length);
rillaboom.forEach(c => {
  console.log(`  - ${c.id}: ${c.names.en}`);
  if (c.abilities) {
    console.log(`    Abilities: ${c.abilities.map(a => a.name).join(', ')}`);
  }
  if (c.attacks) {
    console.log(`    Attacks: ${c.attacks.map(a => a.name).join(', ')}`);
  }
});
