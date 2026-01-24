const cards = require('./public/cards-western.json');

const cardKeys = new Map();
cards.forEach(c => {
  const key = `${c.set}|${c.number}`;
  if (!cardKeys.has(key)) {
    cardKeys.set(key, []);
  }
  cardKeys.get(key).push(c.id);
});

const duplicates = Array.from(cardKeys.entries()).filter(([_, ids]) => ids.length > 1);
console.log('Total duplicate set/number combinations:', duplicates.length);
console.log('\nFirst 20 examples:');
duplicates.slice(0, 20).forEach(([key, ids]) => {
  console.log(`  ${key}: ${ids.join(' vs ')}`);
});

// Analyze patterns
console.log('\nPattern analysis:');
duplicates.slice(0, 10).forEach(([key, ids]) => {
  const [set, num] = key.split('|');
  console.log(`\nSet: ${set}, Number: ${num}`);
  ids.forEach(id => console.log(`  ID: ${id}`));
});
