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

// Group by set name
const bySet = new Map();
duplicates.forEach(([key, ids]) => {
  const [setName, _] = key.split('|');
  if (!bySet.has(setName)) {
    bySet.set(setName, 0);
  }
  bySet.set(setName, bySet.get(setName) + 1);
});

console.log('Duplicates by set:');
Array.from(bySet.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([set, count]) => {
    console.log(`  ${set}: ${count} duplicates`);

    // Show example
    const example = duplicates.find(([key, _]) => key.startsWith(set + '|'));
    if (example) {
      const [_, ids] = example;
      console.log(`    Example: ${ids.join(' vs ')}`);
    }
  });
