import type { Card } from '../types';

export interface DeckStats {
  total: number;
  pokemon: number;
  pokemonBasic: number;
  pokemonStage1: number;
  pokemonStage2: number;
  trainers: number;
  supporters: number;
  items: number;
  tools: number;
  energy: number;
  basicEnergy: number;
  specialEnergy: number;
}

export interface GroupedDeckCards {
  pokemon: {
    basic: Array<{ cardId: string; quantity: number; card: Card }>;
    stage1: Array<{ cardId: string; quantity: number; card: Card }>;
    stage2: Array<{ cardId: string; quantity: number; card: Card }>;
  };
  trainers: {
    supporters: Array<{ cardId: string; quantity: number; card: Card }>;
    items: Array<{ cardId: string; quantity: number; card: Card }>;
    tools: Array<{ cardId: string; quantity: number; card: Card }>;
  };
  energy: {
    basic: Array<{ cardId: string; quantity: number; card: Card }>;
    special: Array<{ cardId: string; quantity: number; card: Card }>;
  };
}

function getCardName(card: Card): string {
  return card.names['en'] || card.names[Object.keys(card.names)[0]] || 'Unknown';
}

function isPokemon(card: Card): boolean {
  return card.supertype === 'Pokémon';
}

function isBasicPokemon(card: Card): boolean {
  return isPokemon(card) && (card.subtypes?.includes('Basic') ?? false);
}

function isStage1Pokemon(card: Card): boolean {
  return isPokemon(card) && (card.subtypes?.includes('Stage 1') ?? false);
}

function isStage2Pokemon(card: Card): boolean {
  return isPokemon(card) && (card.subtypes?.includes('Stage 2') ?? false);
}

function isTrainer(card: Card): boolean {
  return card.supertype === 'Trainer';
}

function isSupporter(card: Card): boolean {
  return isTrainer(card) && (card.subtypes?.includes('Supporter') ?? false);
}

function isItem(card: Card): boolean {
  return isTrainer(card) && (card.subtypes?.includes('Item') ?? false);
}

function isTool(card: Card): boolean {
  return isTrainer(card) && (card.subtypes?.includes('Tool') ?? false);
}

function isEnergy(card: Card): boolean {
  return card.supertype === 'Energy';
}

function isBasicEnergy(card: Card): boolean {
  return isEnergy(card) && (card.subtypes?.includes('Basic') ?? false);
}

function isSpecialEnergy(card: Card): boolean {
  return isEnergy(card) && !isBasicEnergy(card);
}

export function calculateDeckStats(deckCards: Record<string, number>, cardMap: Map<string, Card>): DeckStats {
  const stats: DeckStats = {
    total: 0,
    pokemon: 0,
    pokemonBasic: 0,
    pokemonStage1: 0,
    pokemonStage2: 0,
    trainers: 0,
    supporters: 0,
    items: 0,
    tools: 0,
    energy: 0,
    basicEnergy: 0,
    specialEnergy: 0,
  };

  for (const [cardId, quantity] of Object.entries(deckCards)) {
    const card = cardMap.get(cardId);
    if (!card) continue;

    stats.total += quantity;

    if (isPokemon(card)) {
      stats.pokemon += quantity;
      if (isBasicPokemon(card)) stats.pokemonBasic += quantity;
      else if (isStage1Pokemon(card)) stats.pokemonStage1 += quantity;
      else if (isStage2Pokemon(card)) stats.pokemonStage2 += quantity;
    } else if (isTrainer(card)) {
      stats.trainers += quantity;
      if (isSupporter(card)) stats.supporters += quantity;
      else if (isItem(card)) stats.items += quantity;
      else if (isTool(card)) stats.tools += quantity;
    } else if (isEnergy(card)) {
      stats.energy += quantity;
      if (isBasicEnergy(card)) stats.basicEnergy += quantity;
      else stats.specialEnergy += quantity;
    }
  }

  return stats;
}

export function groupDeckCards(deckCards: Record<string, number>, cardMap: Map<string, Card>): GroupedDeckCards {
  const groups: GroupedDeckCards = {
    pokemon: { basic: [], stage1: [], stage2: [] },
    trainers: { supporters: [], items: [], tools: [] },
    energy: { basic: [], special: [] },
  };

  for (const [cardId, quantity] of Object.entries(deckCards)) {
    const card = cardMap.get(cardId);
    if (!card) continue;

    const entry = { cardId, quantity, card };

    if (isPokemon(card)) {
      if (isBasicPokemon(card)) groups.pokemon.basic.push(entry);
      else if (isStage1Pokemon(card)) groups.pokemon.stage1.push(entry);
      else if (isStage2Pokemon(card)) groups.pokemon.stage2.push(entry);
      else groups.pokemon.basic.push(entry); // Default to basic for other Pokemon types
    } else if (isTrainer(card)) {
      if (isSupporter(card)) groups.trainers.supporters.push(entry);
      else if (isItem(card)) groups.trainers.items.push(entry);
      else if (isTool(card)) groups.trainers.tools.push(entry);
      else groups.trainers.items.push(entry); // Default to items for other trainer types
    } else if (isEnergy(card)) {
      if (isBasicEnergy(card)) groups.energy.basic.push(entry);
      else groups.energy.special.push(entry);
    }
  }

  // Sort each group by card name
  const sortByName = (a: { card: Card }, b: { card: Card }) =>
    getCardName(a.card).localeCompare(getCardName(b.card));

  groups.pokemon.basic.sort(sortByName);
  groups.pokemon.stage1.sort(sortByName);
  groups.pokemon.stage2.sort(sortByName);
  groups.trainers.supporters.sort(sortByName);
  groups.trainers.items.sort(sortByName);
  groups.trainers.tools.sort(sortByName);
  groups.energy.basic.sort(sortByName);
  groups.energy.special.sort(sortByName);

  return groups;
}
