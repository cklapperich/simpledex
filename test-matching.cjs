// Test if the set name + number matching would work
const fs = require('fs');

// Simulate what should happen for lc-99
const tcgdexCard = {
  id: 'lc-99',
  set: 'Legendary Collection',
  number: '99'
};

// Load pokemon-tcg-data
const cardsFiles = fs.readdirSync('pokemon-tcg-data/cards/en');
let found = false;

cardsFiles.forEach(file => {
  const cards = JSON.parse(fs.readFileSync(`pokemon-tcg-data/cards/en/${file}`, 'utf-8'));
  cards.forEach(card => {
    if (!card.set || !card.set.name || !card.number) return;

    const setNumberKey = `${card.set.name}|${card.number}`;
    const tcgdexKey = `${tcgdexCard.set}|${tcgdexCard.number}`;

    if (setNumberKey === tcgdexKey) {
      console.log('MATCH FOUND!');
      console.log('  Pokemon-TCG card ID:', card.id);
      console.log('  Set name:', card.set.name);
      console.log('  Number:', card.number);
      console.log('  Key:', setNumberKey);
      found = true;
    }
  });
});

if (!found) {
  console.log('NO MATCH - checking all Legendary Collection cards:');
  cardsFiles.forEach(file => {
    const cards = JSON.parse(fs.readFileSync(`pokemon-tcg-data/cards/en/${file}`, 'utf-8'));
    cards.forEach(card => {
      if (card.set.name.includes('Legendary') && card.number === '99') {
        console.log('  Card:', card.id, '- Set:', card.set.name, '- Number:', card.number);
      }
    });
  });
}
