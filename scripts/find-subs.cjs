const path = require('path');
const cards = require(path.join(__dirname, '..', 'dist', 'cards-western.json'));
const cardMap = new Map();
cards.forEach(c => cardMap.set(c.id, c));

// Check if trainers have any rules/effect text
const trainerIds = ['me1-119','sv3-186','me1-114','sv45-80','sv105b-85','me1-132','me2-94','sv45-84','sv5-144','sv65-61','me1-130','me1-131','sv105b-79','me1-122'];
for (const id of trainerIds) {
  const c = cardMap.get(id);
  const skip = new Set(['id','names','set','number','setNumber','releaseDate','series','supertype','subtypes','types','ptcgoCode','rarity','illustrator','seriesId','setId','images']);
  const keys = Object.keys(c).filter(k => !skip.has(k));
  if (keys.length > 0) {
    console.log(c.names.en + ': extra keys = ' + keys.join(', '));
    for (const k of keys) console.log('  ' + k + ': ' + JSON.stringify(c[k]));
  } else {
    console.log(c.names.en + ': NO rules/effect text in DB');
  }
}

const modernSeries = ['Mega Evolution','Scarlet & Violet','Sword & Shield','Black & White','Sun & Moon','XY'];

console.log('\n--- Haunter substitutes (modern series) ---');
const haunters = cards.filter(c => (c.names?.en || '') === 'Haunter' && modernSeries.includes(c.series));
for (const h of haunters) {
  console.log(h.names.en + ' | ' + h.set + ' ' + h.number + ' | id:' + h.id + ' | HP:' + h.hp);
  if (h.attacks) h.attacks.forEach(a => console.log('  ATK: ' + a.name + ' [' + (a.cost||[]).join(',') + '] ' + (a.damage||'') + ' ' + (a.effect||'')));
  if (h.abilities) h.abilities.forEach(a => console.log('  ABL: ' + a.name + ': ' + a.effect));
}

console.log('\n--- Meloetta substitutes (modern series) ---');
const meloettas = cards.filter(c => (c.names?.en || '') === 'Meloetta' && modernSeries.includes(c.series));
for (const m of meloettas) {
  console.log(m.names.en + ' | ' + m.set + ' ' + m.number + ' | id:' + m.id + ' | HP:' + m.hp + ' | types:' + (m.types||[]).join(','));
  if (m.attacks) m.attacks.forEach(a => console.log('  ATK: ' + a.name + ' [' + (a.cost||[]).join(',') + '] ' + (a.damage||'') + ' ' + (a.effect||'')));
  if (m.abilities) m.abilities.forEach(a => console.log('  ABL: ' + a.name + ': ' + a.effect));
}
