const cards = require('./public/cards-western.json');

// Check specific examples
const tests = [
  {ids: ['lc-99', 'base6-99'], label: 'Legendary Collection'},
  {ids: ['sv10.5w-173', 'rsv10pt5-173'], label: 'White Flare'},
  {ids: ['sv10.5b-172', 'zsv10pt5-172'], label: 'Black Bolt'},
  {ids: ['hgssp-HGSS25', 'hsp-HGSS25'], label: 'HGSS Promos'},
  {ids: ['cel25c-15_A1', 'cel25c-15_A2', 'cel25c-15_A3', 'cel25c-15_A4'], label: 'Celebrations (4 variants)'}
];

tests.forEach(test => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${test.label}`);
  console.log('='.repeat(60));

  const foundCards = test.ids.map(id => cards.find(c => c.id === id));

  foundCards.forEach((card, idx) => {
    if (card) {
      console.log(`\n[${test.ids[idx]}]`);
      console.log(`  Name: ${card.names.en}`);
      console.log(`  Set: ${card.set}`);
      console.log(`  Number: ${card.number}`);
      console.log(`  Rarity: ${card.rarity}`);
      console.log(`  Supertype: ${card.supertype}`);
      if (card.subtypes && card.subtypes.length > 0) {
        console.log(`  Subtypes: ${card.subtypes.join(', ')}`);
      }
      console.log(`  Images: ${card.images?.length || 0}`);
      card.images?.forEach(img => console.log(`    ${img.source}: ${img.url}`));
    } else {
      console.log(`\n[${test.ids[idx]}] - NOT FOUND`);
    }
  });

  // Check if they're the same
  const names = foundCards.filter(c => c).map(c => c.names.en);
  const allSameName = names.every(n => n === names[0]);
  const sets = foundCards.filter(c => c).map(c => c.set);
  const allSameSet = sets.every(s => s === sets[0]);

  console.log(`\n  VERDICT: ${allSameName && allSameSet ? '✅ LIKELY DUPLICATES' : '❌ DIFFERENT CARDS'}`);
});
