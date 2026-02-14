const cards = require('./public/cards-western.json');

console.log('=== OVERALL COVERAGE ===\n');

// Overall attacks coverage
const withAttacks = cards.filter(c => c.attacks && c.attacks.length > 0).length;
console.log(`Total cards with attacks: ${withAttacks} / ${cards.length} (${(withAttacks/cards.length*100).toFixed(1)}%)`);

// Overall abilities coverage
const withAbilities = cards.filter(c => c.abilities && c.abilities.length > 0).length;
console.log(`Total cards with abilities: ${withAbilities} / ${cards.length} (${(withAbilities/cards.length*100).toFixed(1)}%)`);

console.log('\n=== SWSH PROMOS COVERAGE ===\n');

// SWSH Promos coverage
const swshPromos = cards.filter(c => c.setId === 'swshp' && c.supertype === 'Pokemon');
const swshWithAttacks = swshPromos.filter(c => c.attacks && c.attacks.length > 0);
const swshWithAbilities = swshPromos.filter(c => c.abilities && c.abilities.length > 0);
console.log(`SWSH Promos attacks: ${swshWithAttacks.length} / ${swshPromos.length} (${(swshWithAttacks.length/swshPromos.length*100).toFixed(1)}%)`);
console.log(`SWSH Promos abilities: ${swshWithAbilities.length} / ${swshPromos.length} (${(swshWithAbilities.length/swshPromos.length*100).toFixed(1)}%)`);

console.log('\n=== SPECIFIC CARD TESTS ===\n');

// Venusaur V - attacks test
const venusaur = cards.find(c => c.id === 'swshp-SWSH100');
console.log('Venusaur V (swshp-SWSH100):');
if (venusaur) {
  console.log('  Attacks:', venusaur.attacks?.length || 0);
  if (venusaur.attacks && venusaur.attacks.length > 0) {
    console.log('  Attack 1:', venusaur.attacks[0].name, '-', venusaur.attacks[0].damage);
    if (venusaur.attacks.length > 1) {
      console.log('  Attack 2:', venusaur.attacks[1].name, '-', venusaur.attacks[1].damage);
    }
  }
} else {
  console.log('  ❌ Card not found');
}

// Rillaboom - abilities test
const rillaboom = cards.find(c => c.id === 'swshp-SWSH6');
console.log('\nRillaboom (swshp-SWSH6):');
if (rillaboom) {
  console.log('  Abilities:', rillaboom.abilities?.length || 0);
  if (rillaboom.abilities && rillaboom.abilities.length > 0) {
    console.log('  Ability:', rillaboom.abilities[0].name, '-', rillaboom.abilities[0].type);
  }
  console.log('  Attacks:', rillaboom.attacks?.length || 0);
  if (rillaboom.attacks && rillaboom.attacks.length > 0) {
    console.log('  Attack:', rillaboom.attacks[0].name, '-', rillaboom.attacks[0].damage);
  }
} else {
  console.log('  ❌ Card not found');
}

console.log('\n=== ATTACK FORMAT VALIDATION ===\n');

const sampleCard = cards.find(c => c.attacks && c.attacks.length > 0);
if (sampleCard) {
  const attack = sampleCard.attacks[0];
  const isValid = attack.name &&
    Array.isArray(attack.cost) &&
    (attack.damage !== undefined || attack.effect !== undefined);
  console.log('Sample card:', sampleCard.id, '-', sampleCard.names.en);
  console.log('Valid format:', isValid ? '✅' : '❌');
  console.log('Attack structure:', {
    name: attack.name,
    cost: attack.cost,
    damage: attack.damage,
    effect: attack.effect ? attack.effect.substring(0, 50) + '...' : undefined
  });
}
