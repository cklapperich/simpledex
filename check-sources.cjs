const cards = require('./public/cards-western.json');

// Check the three sv-151 variations
const testIds = ['sv-151', 'sv01-151', 'sv1-151'];
console.log('Checking sources for sv-151 variations:\n');

testIds.forEach(id => {
  const card = cards.find(c => c.id === id);
  if (card) {
    console.log(`${id}:`);
    console.log(`  Name: ${card.names.en}`);
    console.log(`  Set: ${card.set}`);
    console.log(`  seriesId: ${card.seriesId}`);
    console.log(`  setId: ${card.setId}`);
    console.log(`  Images:`);
    card.images?.forEach(img => {
      console.log(`    ${img.source}: ${img.url}`);
    });
    console.log();
  }
});

// Check swsh12 variations
console.log('\nChecking sources for Crown Zenith variations:\n');
const crownIds = ['swsh12.5-160', 'swsh12pt5-160'];
crownIds.forEach(id => {
  const card = cards.find(c => c.id === id);
  if (card) {
    console.log(`${id}:`);
    console.log(`  seriesId: ${card.seriesId}, setId: ${card.setId}`);
    console.log(`  Images:`);
    card.images?.forEach(img => {
      console.log(`    ${img.source}: ${img.url}`);
    });
    console.log();
  }
});
