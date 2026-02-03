import type { Card } from '../types';
import { getCardName } from './cardUtils';

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

export type DeckCardEntry = { cardId: string; quantity: number; card: Card };

export interface GroupedDeckCards {
  pokemon: DeckCardEntry[];  // Flat list sorted by stage (Basic, Stage1, Stage2)
  trainers: {
    supporters: DeckCardEntry[];
    items: DeckCardEntry[];
    tools: DeckCardEntry[];
  };
  energy: DeckCardEntry[];  // Flat list sorted by basic first, then special
}

function isPokemon(card: Card): boolean {
  return card.supertype === 'Pokemon' || card.supertype === 'Pokémon';
}

function isBasicPokemon(card: Card): boolean {
  return isPokemon(card) && (card.subtypes?.includes('Basic') ?? false);
}

function isStage1Pokemon(card: Card): boolean {
  return isPokemon(card) && (card.subtypes?.some(s => s === 'Stage 1' || s === 'Stage1') ?? false);
}

function isStage2Pokemon(card: Card): boolean {
  return isPokemon(card) && (card.subtypes?.some(s => s === 'Stage 2' || s === 'Stage2') ?? false);
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

// Get evolution stage order for sorting (Basic=0, Stage1=1, Stage2=2, other=3)
function getEvolutionOrder(card: Card): number {
  if (isBasicPokemon(card)) return 0;
  if (isStage1Pokemon(card)) return 1;
  if (isStage2Pokemon(card)) return 2;
  return 3;
}

// Get energy order for sorting (Basic=0, Special=1)
function getEnergyOrder(card: Card): number {
  return isBasicEnergy(card) ? 0 : 1;
}

export function groupDeckCards(deckCards: Record<string, number>, cardMap: Map<string, Card>): GroupedDeckCards {
  const groups: GroupedDeckCards = {
    pokemon: [],
    trainers: { supporters: [], items: [], tools: [] },
    energy: [],
  };

  for (const [cardId, quantity] of Object.entries(deckCards)) {
    const card = cardMap.get(cardId);
    if (!card) continue;

    const entry = { cardId, quantity, card };

    if (isPokemon(card)) {
      groups.pokemon.push(entry);
    } else if (isTrainer(card)) {
      if (isSupporter(card)) groups.trainers.supporters.push(entry);
      else if (isItem(card)) groups.trainers.items.push(entry);
      else if (isTool(card)) groups.trainers.tools.push(entry);
      else groups.trainers.items.push(entry); // Default to items for other trainer types
    } else if (isEnergy(card)) {
      groups.energy.push(entry);
    }
  }

  // Sort Pokemon by evolution stage, then by name
  groups.pokemon.sort((a, b) => {
    const stageA = getEvolutionOrder(a.card);
    const stageB = getEvolutionOrder(b.card);
    if (stageA !== stageB) return stageA - stageB;
    return getCardName(a.card).localeCompare(getCardName(b.card));
  });

  // Sort energy by type (basic first), then by name
  groups.energy.sort((a, b) => {
    const typeA = getEnergyOrder(a.card);
    const typeB = getEnergyOrder(b.card);
    if (typeA !== typeB) return typeA - typeB;
    return getCardName(a.card).localeCompare(getCardName(b.card));
  });

  // Sort trainer groups by name
  const sortByName = (a: { card: Card }, b: { card: Card }) =>
    getCardName(a.card).localeCompare(getCardName(b.card));

  groups.trainers.supporters.sort(sortByName);
  groups.trainers.items.sort(sortByName);
  groups.trainers.tools.sort(sortByName);

  return groups;
}
