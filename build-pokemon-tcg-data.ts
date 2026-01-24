import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POKEMON_TCG_DATA_DIR = path.join(__dirname, 'pokemon-tcg-data');

// Pokemon TCG Data card interface (simplified to what we need)
export interface PokemonTCGCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  attacks?: Array<{
    name: string;
    cost: string[];
    convertedEnergyCost: number;
    damage?: string;
    text?: string;
  }>;
  abilities?: Array<{
    name: string;
    text: string;
    type: string;
  }>;
  weaknesses?: Array<{
    type: string;
    value: string;
  }>;
  resistances?: Array<{
    type: string;
    value: string;
  }>;
  retreatCost?: string[];
  convertedRetreatCost?: number;
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    releaseDate: string;
    ptcgoCode?: string;
  };
  number: string;
  rarity?: string;
  images: {
    small: string;
    large: string;
  };
}

export interface PokemonTCGSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  ptcgoCode?: string;
  images: {
    symbol: string;
    logo: string;
  };
}

// Build script card interface (same as in build-multi-language.ts)
interface MultiLangCard {
  id: string;
  names: Record<string, string>;
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
  seriesId?: string;
  setId?: string;
}

export interface PokemonTCGData {
  cards: Map<string, PokemonTCGCard>;
  sets: Map<string, PokemonTCGSet>;
  // Secondary index for matching by set name + card number (handles ID mismatches)
  cardsBySetAndNumber: Map<string, PokemonTCGCard>;
}

/**
 * Load pokemon-tcg-data from JSON files
 * Returns empty Maps if submodule not initialized (graceful degradation)
 */
export async function loadPokemonTCGData(): Promise<PokemonTCGData> {
  const cards = new Map<string, PokemonTCGCard>();
  const sets = new Map<string, PokemonTCGSet>();
  const cardsBySetAndNumber = new Map<string, PokemonTCGCard>();

  // Check if submodule is initialized
  const cardsDir = path.join(POKEMON_TCG_DATA_DIR, 'cards', 'en');
  const setsFile = path.join(POKEMON_TCG_DATA_DIR, 'sets', 'en.json');

  if (!fs.existsSync(cardsDir) || !fs.existsSync(setsFile)) {
    console.log('⚠️  pokemon-tcg-data not found - skipping (run: git submodule update --init)');
    return { cards, sets, cardsBySetAndNumber };
  }

  console.log('\nLoading pokemon-tcg-data...');

  try {
    // Load sets first
    const setsData = JSON.parse(fs.readFileSync(setsFile, 'utf-8')) as PokemonTCGSet[];
    for (const set of setsData) {
      sets.set(set.id, set);
    }
    console.log(`  Loaded ${sets.size} sets`);

    // Load all card files
    const cardFiles = await glob('*.json', {
      cwd: cardsDir,
      absolute: true
    });

    let totalCards = 0;
    for (const cardFile of cardFiles) {
      try {
        const cardsData = JSON.parse(fs.readFileSync(cardFile, 'utf-8')) as PokemonTCGCard[];

        for (const card of cardsData) {
          cards.set(card.id, card);

          // Build secondary index: setName|cardNumber -> card
          // Cards don't have set property - extract set ID from card ID and look up set name
          const setId = card.id.split('-')[0];
          const set = sets.get(setId);

          if (set && card.number) {
            const setNumberKey = `${set.name}|${card.number}`;
            cardsBySetAndNumber.set(setNumberKey, card);
          }

          totalCards++;
        }
      } catch (error) {
        console.error(`  Error loading ${path.basename(cardFile)}:`, error);
      }
    }

    console.log(`  Loaded ${totalCards} cards from ${cardFiles.length} files`);
  } catch (error) {
    console.error('  Error loading pokemon-tcg-data:', error);
  }

  return { cards, sets, cardsBySetAndNumber };
}

/**
 * Convert pokemon-tcg-data card format to MultiLangCard format
 */
export function convertPokemonTCGCard(ptcgCard: PokemonTCGCard, ptcgSet: PokemonTCGSet): MultiLangCard {
  return {
    id: ptcgCard.id,
    names: { en: ptcgCard.name }, // Only English name available
    set: ptcgSet.name,
    number: ptcgCard.number,
    setNumber: `${ptcgSet.name} ${ptcgCard.number}`,
    releaseDate: ptcgSet.releaseDate.replace(/-/g, '/'),
    series: ptcgSet.series,
    supertype: ptcgCard.supertype,
    subtypes: ptcgCard.subtypes || [],
    types: ptcgCard.types || [],
    ptcgoCode: ptcgSet.ptcgoCode,
    rarity: ptcgCard.rarity || 'Common',
    hp: ptcgCard.hp ? parseInt(ptcgCard.hp) : undefined,
    attacks: ptcgCard.attacks?.map(attack => ({
      name: attack.name,
      cost: attack.cost,
      damage: attack.damage,
      effect: attack.text
    })),
    abilities: ptcgCard.abilities?.map(ability => ({
      name: ability.name,
      effect: ability.text,
      type: ability.type
    })),
    weaknesses: ptcgCard.weaknesses?.map(w => ({
      type: w.type,
      value: w.value
    })),
    resistances: ptcgCard.resistances?.map(r => ({
      type: r.type,
      value: r.value
    })),
    retreatCost: ptcgCard.retreatCost,
    seriesId: undefined, // No tcgdex ID mapping available
    setId: undefined
  };
}
