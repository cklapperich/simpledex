const cards = require('./public/cards-western.json');

// Find all me1/me01 cards
const me1Cards = cards.filter(c => c.id.startsWith('me1-') || c.id.startsWith('me01-'));

// Group by set name + normalized number (parseInt removes leading zeros)
const grouped = {};
me1Cards.forEach(c => {
  const key = c.set + '|' + parseInt(c.number);
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(c.id);
});

// Find duplicates
const duplicates = Object.entries(grouped).filter(([k,v]) => v.length > 1);

console.log('Total me1/me01 cards:', me1Cards.length);
console.log('Duplicate combinations:', duplicates.length);
console.log('\nAll duplicates:');
duplicates.forEach(([key, ids]) => console.log(`  ${key}: ${ids.join(' vs ')}`));
