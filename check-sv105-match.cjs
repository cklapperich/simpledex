const cards = require('./public/cards-western.json');

// Find the specific duplicate cards
const card1 = cards.find(c => c.id === 'sv10.5b-029');
const card2 = cards.find(c => c.id === 'zsv10pt5-29');

console.log('Card 1 (TCGdex):');
console.log('  ID:', card1.id);
console.log('  Name:', card1.names.en);
console.log('  Set:', card1.set);
console.log('  Number:', card1.number);

console.log('\nCard 2 (pokemon-tcg-data):');
console.log('  ID:', card2.id);
console.log('  Name:', card2.names.en);
console.log('  Set:', card2.set);
console.log('  Number:', card2.number);

console.log('\nSet+Number match key:');
console.log('  Card 1:', `${card1.set}|${card1.number}`);
console.log('  Card 2:', `${card2.set}|${card2.number}`);
console.log('  Match?:', `${card1.set}|${card1.number}` === `${card2.set}|${card2.number}`);
