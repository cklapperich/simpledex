/**
 * build-ptcg.ts — Build cards-western.json from pokemon-tcg-data exclusively.
 *
 * Key differences from build-multi-language.ts:
 * - No tcgdex dependency: pure JSON parsing, no regex hacks
 * - IDs are native ptcg-data IDs verbatim (no normalizeCardId)
 * - Adds legalities, regulationMark, illustrator fields
 * - Removes seriesId, setId (tcgdex-only)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loadPokemonTCGData, type PokemonTCGCard, type PokemonTCGSet } from './build-pokemon-tcg-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'public');

const INCLUDE_MCDONALDS_PROMOS = false;

interface PTCGCard {
  id: string;
  names: { en: string };
  set: string;
  number: string;
  setNumber?: string;
  releaseDate: string;
  series: string;
  supertype: string;
  subtypes: string[];
  types: string[];
  ptcgoCode?: string;
  rarity: string;
  illustrator?: string;
  hp?: number;
  attacks?: Array<{
    name: string;
    cost: string[];
    damage?: string;
    effect?: string;
  }>;
  abilities?: Array<{
    name: string;
    effect: string;
    type: string;
  }>;
  weaknesses?: Array<{
    type: string;
    value?: string;
  }>;
  resistances?: Array<{
    type: string;
    value?: string;
  }>;
  retreatCost?: string[];
  evolveFrom?: string;
  flavorText?: string;
  rules?: string[];
  legalities?: {
    standard?: string;
    expanded?: string;
    unlimited?: string;
  };
  regulationMark?: string;
  images?: Array<{
    url: string;
    size: 'small' | 'large';
  }>;
}

function convertCard(card: PokemonTCGCard, set: PokemonTCGSet): PTCGCard {
  return {
    id: card.id,
    names: { en: card.name.replace(/-GX$/, ' GX').replace(/-EX$/, ' EX') },
    set: set.name,
    number: card.number,
    setNumber: `${set.name} ${card.number}`,
    releaseDate: set.releaseDate.replace(/-/g, '/'),
    series: set.series,
    supertype: card.supertype.replace('Pokémon', 'Pokemon'),
    subtypes: card.subtypes || [],
    types: card.types || [],
    ptcgoCode: set.ptcgoCode,
    rarity: card.rarity || 'Common',
    illustrator: (card as unknown as { artist?: string }).artist,
    hp: card.hp ? parseInt(card.hp) : undefined,
    attacks: card.attacks?.map(a => ({
      name: a.name,
      cost: a.cost,
      damage: a.damage,
      effect: a.text,
    })),
    abilities: card.abilities?.map(a => ({
      name: a.name,
      effect: a.text,
      type: a.type,
    })),
    weaknesses: card.weaknesses?.map(w => ({ type: w.type, value: w.value })),
    resistances: card.resistances?.map(r => ({ type: r.type, value: r.value })),
    retreatCost: card.retreatCost,
    evolveFrom: card.evolvesFrom,
    flavorText: card.flavorText,
    rules: card.rules,
    legalities: (card as unknown as { legalities?: PTCGCard['legalities'] }).legalities,
    regulationMark: (card as unknown as { regulationMark?: string }).regulationMark,
    images: [
      { url: card.images.small, size: 'small' },
      { url: card.images.large, size: 'large' },
    ],
  };
}

async function build() {
  const data = await loadPokemonTCGData();

  if (data.cards.size === 0) {
    console.error('❌ No cards loaded — is the pokemon-tcg-data submodule initialized?');
    process.exit(1);
  }

  const cards: PTCGCard[] = [];

  // codeToSet / setToCode for set-codes.json
  const codeToSet: Record<string, string> = {};
  const setToCode: Record<string, string> = {};

  let skippedMcDonald = 0;
  let skippedPocket = 0;
  let skippedNoSet = 0;

  for (const card of data.cards.values()) {
    // Derive set ID from native card ID (everything before first '-')
    const setId = card.id.split('-')[0];
    const set = data.sets.get(setId);

    if (!set) {
      skippedNoSet++;
      continue;
    }

    // Exclude McDonald's promos
    if (!INCLUDE_MCDONALDS_PROMOS && set.name.startsWith("McDonald's Collection")) {
      skippedMcDonald++;
      continue;
    }

    // Exclude Pokémon TCG Pocket sets
    if (set.series === 'Pokémon TCG Pocket') {
      skippedPocket++;
      continue;
    }

    cards.push(convertCard(card, set));

    // Build set-codes mapping
    if (set.ptcgoCode) {
      const code = set.ptcgoCode.toUpperCase();
      codeToSet[code] = set.name;
      setToCode[set.name] = code;
    }
  }

  // Sort by releaseDate then set then number
  cards.sort((a, b) => {
    const dateComp = a.releaseDate.localeCompare(b.releaseDate);
    if (dateComp !== 0) return dateComp;
    const setComp = a.set.localeCompare(b.set);
    if (setComp !== 0) return setComp;
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write cards-western.json
  const cardsFile = path.join(OUTPUT_DIR, 'cards-western.json');
  fs.writeFileSync(cardsFile, JSON.stringify(cards), 'utf-8');
  const sizeMB = (fs.statSync(cardsFile).size / 1024 / 1024).toFixed(2);
  console.log(`\n📦 ${cardsFile}`);
  console.log(`   Cards: ${cards.length}`);
  console.log(`   Size: ${sizeMB} MB`);
  if (skippedMcDonald) console.log(`   Skipped McDonald's: ${skippedMcDonald}`);
  if (skippedPocket) console.log(`   Skipped Pocket: ${skippedPocket}`);
  if (skippedNoSet) console.log(`   Skipped (no set): ${skippedNoSet}`);

  // Write set-codes.json
  const setCodesFile = path.join(OUTPUT_DIR, 'set-codes.json');
  fs.writeFileSync(setCodesFile, JSON.stringify({ codeToSet, setToCode }, null, 2), 'utf-8');
  console.log(`\n📋 ${setCodesFile}`);
  console.log(`   Sets with code: ${Object.keys(codeToSet).length}`);

  console.log('\n✅ Build complete!');
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
