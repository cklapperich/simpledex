import type { Card, Deck, DeckValidation } from '../types';
import { get } from 'svelte/store';
import { cardMap } from '../stores/cards';

/**
 * Export deck to PTCGO format
 * Format: * {quantity} {cardName} {ptcgoCode} {number}
 * Example: * 1 Mimikyu TEU 112
 */
export function exportToPTCGO(deck: Deck, cards: Map<string, Card>): string {
  const lines: string[] = [];

  for (const [cardId, quantity] of Object.entries(deck.cards)) {
    const card = cards.get(cardId);
    if (!card) {
      console.warn(`Card ${cardId} not found in card database`);
      continue;
    }

    const ptcgoCode = card.ptcgoCode || card.set;
    const line = `* ${quantity} ${card.name} ${ptcgoCode} ${card.number}`;
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Import deck from PTCGO format
 * Parses lines like: * 1 Mimikyu TEU 112
 * Returns: { cardId -> quantity }
 */
export function importFromPTCGO(ptcgoText: string, cards: Map<string, Card>): Record<string, number> {
  const result: Record<string, number> = {};
  const lines = ptcgoText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // Build lookup maps for faster matching
  const cardsByNameCodeNumber = new Map<string, Card>();
  for (const card of cards.values()) {
    const ptcgoCode = card.ptcgoCode || card.set;
    const key = `${card.name.toLowerCase()}|${ptcgoCode.toLowerCase()}|${card.number}`;
    cardsByNameCodeNumber.set(key, card);
  }

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;

    // Match pattern: * {qty} {name} {code} {number}
    const match = line.match(/^\*\s+(\d+)\s+(.+?)\s+([A-Za-z0-9]+)\s+([A-Za-z0-9-]+)$/);
    if (!match) {
      console.warn(`Could not parse line: ${line}`);
      continue;
    }

    const [, qtyStr, cardName, setCode, cardNumber] = match;
    const quantity = parseInt(qtyStr, 10);

    if (quantity <= 0) continue;

    // Try to find matching card
    const key = `${cardName.toLowerCase()}|${setCode.toLowerCase()}|${cardNumber}`;
    const card = cardsByNameCodeNumber.get(key);

    if (card) {
      result[card.id] = quantity;
    } else {
      console.warn(`Card not found: ${cardName} ${setCode} ${cardNumber}`);
    }
  }

  return result;
}

/**
 * Validate deck according to Pokemon TCG rules
 * - Warn if not exactly 60 cards
 * - Warn if more than 4 copies of any card (except Basic Energy)
 */
export function validateDeck(deck: Deck, cards: Map<string, Card>): DeckValidation {
  const warnings: string[] = [];
  let cardCount = 0;

  // Count total cards
  for (const quantity of Object.values(deck.cards)) {
    cardCount += quantity;
  }

  // Check 60 card rule
  if (cardCount !== 60) {
    warnings.push(`Deck has ${cardCount} cards (standard format requires 60)`);
  }

  // Check 4-of rule (except Basic Energy)
  for (const [cardId, quantity] of Object.entries(deck.cards)) {
    const card = cards.get(cardId);
    if (!card) continue;

    // Basic Energy cards are unlimited
    const isBasicEnergy = card.supertype === 'Energy' && card.subtypes?.includes('Basic');

    if (!isBasicEnergy && quantity > 4) {
      warnings.push(`${card.name}: ${quantity} copies (max 4 allowed)`);
    }
  }

  return {
    isValid: warnings.length === 0,
    cardCount,
    warnings
  };
}

/**
 * Sort deck cards by type: Pokemon -> Trainer -> Energy
 */
export function sortDeckCards(deckCards: Record<string, number>, cards: Map<string, Card>): Array<{ cardId: string; quantity: number; card: Card }> {
  const cardsWithData: Array<{ cardId: string; quantity: number; card: Card }> = [];

  for (const [cardId, quantity] of Object.entries(deckCards)) {
    const card = cards.get(cardId);
    if (card) {
      cardsWithData.push({ cardId, quantity, card });
    }
  }

  // Sort by supertype order, then by name
  const typeOrder: Record<string, number> = {
    'Pokémon': 1,
    'Trainer': 2,
    'Energy': 3
  };

  cardsWithData.sort((a, b) => {
    const orderA = typeOrder[a.card.supertype] || 999;
    const orderB = typeOrder[b.card.supertype] || 999;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.card.name.localeCompare(b.card.name);
  });

  return cardsWithData;
}
