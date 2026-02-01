import type { Card, Deck, DeckValidation } from '../types';
import { MODERN_SERIES } from '../constants';

/**
 * Export deck to PTCGO format
 * Format: * {quantity} {cardName} {setName} {number}
 * Example: * 1 Mimikyu Prismatic Evolutions 112
 */
export function exportToPTCGO(deck: Deck, cards: Map<string, Card>): string {
  const lines: string[] = [];

  for (const [cardId, quantity] of Object.entries(deck.cards)) {
    const card = cards.get(cardId);
    if (!card) {
      console.warn(`Card ${cardId} not found in card database`);
      continue;
    }

    const setName = card.set;  // Always use full set name
    const line = `* ${quantity} ${(card.names['en'] || card.names[Object.keys(card.names)[0]] || 'Unknown')} ${setName} ${card.number}`;
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Import deck from PTCGO format
 * Parses lines like: * 1 Professor's Research Prismatic Evolutions 122
 * Returns: { cardId -> quantity }
 */
export function importFromPTCGO(ptcgoText: string, cards: Map<string, Card>): Record<string, number> {
  const result: Record<string, number> = {};

  // Build set of known set names (lowercase for matching)
  const knownSets = new Set<string>();
  for (const card of cards.values()) {
    if (card.set) knownSets.add(card.set.toLowerCase());
  }

  // Build lookup by name|set|number
  const cardsByNameSetNumber = new Map<string, Card>();
  for (const card of cards.values()) {
    const name = (card.names['en'] || card.names[Object.keys(card.names)[0]] || 'Unknown').toLowerCase();
    const set = (card.set || '').toLowerCase();
    const key = `${name}|${set}|${card.number}`;
    cardsByNameSetNumber.set(key, card);
  }

  for (const line of ptcgoText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    // Match: * {qty} {rest...} {number}
    const match = trimmed.match(/^\*\s+(\d+)\s+(.+)\s+([A-Za-z0-9-]+)$/);
    if (!match) {
      console.warn(`Could not parse line: ${trimmed}`);
      continue;
    }

    const [, qtyStr, middle, cardNumber] = match;
    const quantity = parseInt(qtyStr, 10);
    if (quantity <= 0) continue;

    // Try to find a known set name in 'middle' (from the end)
    // middle = "Professor's Research Prismatic Evolutions"
    // We need to split into cardName="Professor's Research" and setName="Prismatic Evolutions"

    let foundCard: Card | undefined;
    const middleLower = middle.toLowerCase();

    for (const setName of knownSets) {
      if (middleLower.endsWith(setName)) {
        const cardName = middle.slice(0, -(setName.length)).trim();
        const key = `${cardName.toLowerCase()}|${setName}|${cardNumber}`;
        const card = cardsByNameSetNumber.get(key);
        if (card) {
          foundCard = card;
          break;
        }
      }
    }

    if (foundCard) {
      result[foundCard.id] = quantity;
    } else {
      console.warn(`Card not found: ${middle} ${cardNumber}`);
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
      warnings.push(`${(card.names['en'] || card.names[Object.keys(card.names)[0]] || 'Unknown')}: ${quantity} copies (max 4 allowed)`);
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

    const nameA = a.card.names['en'] || a.card.names[Object.keys(a.card.names)[0]] || 'Unknown';
    const nameB = b.card.names['en'] || b.card.names[Object.keys(b.card.names)[0]] || 'Unknown';
    return nameA.localeCompare(nameB);
  });

  return cardsWithData;
}

/**
 * Get the card name for GLC validation
 */
function getCardNameForGLC(card: Card): string {
  return card.names['en'] || card.names[Object.keys(card.names)[0]] || 'Unknown';
}

/**
 * GLC validation result
 */
export interface GLCValidationResult {
  canAdd: boolean;
  reason?: string;
}

/**
 * Validate if a card can be added to a deck under GLC (Gym Leader Challenge) rules
 * GLC Rules:
 * 1. Modern series only (Black & White onwards)
 * 2. Only 1 copy of each card NAME (not ID) - different printings count as the same card
 * 3. Basic Energy cards are exempt from the 1-copy rule
 */
export function validateGLCAddition(
  cardToAdd: Card,
  deckCards: Record<string, number>,
  cardMap: Map<string, Card>
): GLCValidationResult {
  // Rule 1: Modern series only
  if (!MODERN_SERIES.includes(cardToAdd.series)) {
    return { canAdd: false, reason: 'Card is not from a modern series (Black & White onwards)' };
  }

  // Basic Energy cards are exempt from the 1-copy rule
  const isBasicEnergy = cardToAdd.supertype === 'Energy' && cardToAdd.subtypes?.includes('Basic');
  if (isBasicEnergy) {
    return { canAdd: true };
  }

  // Rule 2: 1 copy per NAME (not per ID)
  const cardName = getCardNameForGLC(cardToAdd);
  for (const [existingId, qty] of Object.entries(deckCards)) {
    if (qty <= 0) continue;
    const existingCard = cardMap.get(existingId);
    if (!existingCard) continue;

    const existingName = getCardNameForGLC(existingCard);
    if (existingName === cardName) {
      return { canAdd: false, reason: `Already have ${cardName} in deck (GLC allows only 1 copy per card name)` };
    }
  }

  return { canAdd: true };
}

/**
 * Validate an entire deck according to GLC rules
 * Returns a list of all violations found
 */
export function validateDeckGLC(deck: Deck, cardMap: Map<string, Card>): string[] {
  const violations: string[] = [];
  const cardNameCounts = new Map<string, { count: number; cards: string[] }>();

  for (const [cardId, quantity] of Object.entries(deck.cards)) {
    if (quantity <= 0) continue;
    const card = cardMap.get(cardId);
    if (!card) continue;

    // Check modern series
    if (!MODERN_SERIES.includes(card.series)) {
      const cardName = getCardNameForGLC(card);
      violations.push(`${cardName} is not from a modern series`);
    }

    // Skip basic energy for name counting
    const isBasicEnergy = card.supertype === 'Energy' && card.subtypes?.includes('Basic');
    if (isBasicEnergy) continue;

    // Count card names
    const cardName = getCardNameForGLC(card);
    const existing = cardNameCounts.get(cardName) || { count: 0, cards: [] };
    existing.count += quantity;
    existing.cards.push(`${card.set} ${card.number}`);
    cardNameCounts.set(cardName, existing);
  }

  // Check for duplicate names
  for (const [name, data] of cardNameCounts) {
    if (data.count > 1) {
      violations.push(`${name}: ${data.count} copies (GLC allows only 1)`);
    }
  }

  return violations;
}
