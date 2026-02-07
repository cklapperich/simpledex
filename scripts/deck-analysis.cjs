#!/usr/bin/env node
/**
 * Extract full card text for all unique cards in a deck.
 * Used for strategy analysis and heuristic generation.
 */

const path = require('path');
const cards = require(path.join(__dirname, '..', 'dist', 'cards-western.json'));
const cardMap = new Map();
cards.forEach(c => cardMap.set(c.id, c));

const deckCards = [
  'me2-41',   // Mega Diancie ex
  'me2-40',   // Meloetta
  'me1-63',   // Grumpig
  'me1-62',   // Spoink
  'me2-44',   // Alcremie
  'me2-43',   // Milcery
  'me2-42',   // Mimikyu
  'me2-39',   // Cresselia
  'me2-45',   // Zacian
  'me1-119',  // Lillie's Determination
  'sv3-186',  // Arven
  'me1-114',  // Boss's Orders
  'sv45-80',  // Iono
  'sv105b-85',// Professor's Research
  'me1-132',  // Wally's Compassion
  'me2-94',   // Wondrous Patch
  'sv45-84',  // Nest Ball
  'sv5-144',  // Buddy-Buddy Poffin
  'sv65-61',  // Night Stretcher
  'me1-130',  // Switch
  'me1-131',  // Ultra Ball
  'sv105b-79',// Air Balloon
  'me1-122',  // Mystery Garden
];

for (const id of deckCards) {
  const c = cardMap.get(id);
  if (!c) {
    console.log('NOT FOUND: ' + id);
    continue;
  }

  console.log('========================================');
  console.log(c.names.en + ' (' + c.set + ' ' + c.number + ')');
  console.log('Type: ' + c.supertype + (c.subtypes ? ' [' + c.subtypes.join(', ') + ']' : ''));
  if (c.types && c.types.length) console.log('Energy Type: ' + c.types.join(', '));
  if (c.hp) console.log('HP: ' + c.hp);
  if (c.retreatCost) console.log('Retreat: ' + c.retreatCost.length);

  if (c.abilities && c.abilities.length) {
    for (const a of c.abilities) {
      console.log('ABILITY: ' + a.name);
      console.log('  ' + a.effect);
    }
  }

  if (c.attacks && c.attacks.length) {
    for (const a of c.attacks) {
      const cost = a.cost ? a.cost.join(', ') : 'none';
      console.log('ATTACK: ' + a.name + ' [' + cost + '] => ' + (a.damage || '—'));
      if (a.text) console.log('  ' + a.effect);
    }
  }

  if (c.rules && c.rules.length) {
    for (const r of c.rules) {
      console.log('RULE: ' + r);
    }
  }

  if (c.weaknesses && c.weaknesses.length) {
    console.log('Weakness: ' + c.weaknesses.map(w => w.type + ' ' + w.value).join(', '));
  }
  if (c.resistances && c.resistances.length) {
    console.log('Resistance: ' + c.resistances.map(r => r.type + ' ' + r.value).join(', '));
  }
  console.log('');
}
