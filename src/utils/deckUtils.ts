import type { Card, Deck, DeckValidation } from '../types';
import { MODERN_SERIES } from '../constants';
import { getCardName } from './cardUtils';

/** Strip leading zeros from card numbers for flexible matching */
function normalizeNumber(num: string): string {
  return num.replace(/^0+/, '') || '0';
}

/** Normalize card name for matching: lowercase + normalize quotes/dashes */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2018\u2019\u2032]/g, "'")   // curly quotes → straight
    .replace(/[\u201C\u201D]/g, '"')          // curly double quotes → straight
    .replace(/[\u2013\u2014]/g, '-');          // en/em dash → hyphen
}

/** Common alternative set codes that map to database ptcgoCodes */
const SET_CODE_ALIASES: Record<string, string> = {
  'svi': 'sv',      // Scarlet & Violet base
  'pr-sv': 'svp',   // SV Black Star Promos
  'mee': 'sve',     // "Mega Evolution Energies" → SV Energies
};

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
    const line = `* ${quantity} ${getCardName(card)} ${setName} ${card.number}`;
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Import deck from PTCGO format
 * Parses lines like: * 1 Professor's Research Prismatic Evolutions 122
 * Also supports ptcgoCode format: * 2 Charizard TEU 14
 * Returns: { cardId -> quantity }
 */
export function importFromPTCGO(ptcgoText: string, cards: Map<string, Card>): Record<string, number> {
  const result: Record<string, number> = {};

  // Build set of known set names and ptcgoCodes (lowercase for matching)
  const knownSets = new Set<string>();
  const knownPtcgoCodes = new Set<string>();
  for (const card of cards.values()) {
    if (card.set) knownSets.add(card.set.toLowerCase());
    if (card.ptcgoCode) knownPtcgoCodes.add(card.ptcgoCode.toLowerCase());
  }

  // Build lookup by name|set|number (for full set names)
  const cardsByNameSetNumber = new Map<string, Card>();
  // Build lookup by name|ptcgoCode|number
  const cardsByNamePtcgoNumber = new Map<string, Card>();

  for (const card of cards.values()) {
    const name = normalizeName(getCardName(card));
    const set = (card.set || '').toLowerCase();
    const ptcgoCode = (card.ptcgoCode || '').toLowerCase();

    // Add both lookups (normalize number to strip leading zeros)
    const normNum = normalizeNumber(String(card.number));
    if (set) {
      const key = `${name}|${set}|${normNum}`;
      cardsByNameSetNumber.set(key, card);
    }
    if (ptcgoCode) {
      const key = `${name}|${ptcgoCode}|${normNum}`;
      cardsByNamePtcgoNumber.set(key, card);
    }
  }

  for (const line of ptcgoText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    // Match: * {qty} {rest...} {number}
    const match = trimmed.match(/^(?:\*\s+)?(\d+)\s+(.+)\s+([A-Za-z0-9-]+)$/);
    if (!match) {
      // Silently skip non-card lines (headers, blank lines, etc.)
      continue;
    }

    const [, qtyStr, middle, cardNumber] = match;
    const quantity = parseInt(qtyStr, 10);
    if (quantity <= 0) continue;

    // Try to find a known set name or ptcgoCode in 'middle' (from the end)
    // middle = "Professor's Research Prismatic Evolutions" or "Charizard TEU"
    // We need to split into cardName and setName/ptcgoCode

    let foundCard: Card | undefined;
    const middleNorm = normalizeName(middle);

    const normCardNumber = normalizeNumber(cardNumber);

    // Try full set names first
    for (const setName of knownSets) {
      if (middleNorm.endsWith(setName)) {
        const cardName = middleNorm.slice(0, -(setName.length)).trim();
        const key = `${cardName}|${setName}|${normCardNumber}`;
        const card = cardsByNameSetNumber.get(key);
        if (card) {
          foundCard = card;
          break;
        }
      }
    }

    // If not found, try ptcgoCodes
    if (!foundCard) {
      for (const ptcgoCode of knownPtcgoCodes) {
        if (middleNorm.endsWith(ptcgoCode)) {
          const cardName = middleNorm.slice(0, -(ptcgoCode.length)).trim();
          const key = `${cardName}|${ptcgoCode}|${normCardNumber}`;
          const card = cardsByNamePtcgoNumber.get(key);
          if (card) {
            foundCard = card;
            break;
          }
        }
      }
    }

    // If not found, try set code aliases and Trainer Gallery/Galarian Gallery suffixes
    if (!foundCard) {
      const lastSpaceIdx = middleNorm.lastIndexOf(' ');
      if (lastSpaceIdx > 0) {
        const potentialCode = middleNorm.slice(lastSpaceIdx + 1);
        const cardName = middleNorm.slice(0, lastSpaceIdx).trim();

        // Try alias mapping (e.g., SVI → SV, PR-SV → SVP)
        const aliasedCode = SET_CODE_ALIASES[potentialCode];
        if (aliasedCode) {
          const key = `${cardName}|${aliasedCode}|${normCardNumber}`;
          foundCard = cardsByNamePtcgoNumber.get(key);
        }

        // Try Trainer Gallery / Galarian Gallery suffix (e.g., SIT-TG 27 → SIT TG27)
        if (!foundCard) {
          const tgMatch = potentialCode.match(/^(.+)-(tg|gg)$/);
          if (tgMatch) {
            const baseCode = tgMatch[1];
            const prefix = tgMatch[2].toUpperCase();
            const prefixedNumber = normalizeNumber(prefix + cardNumber);
            if (knownPtcgoCodes.has(baseCode)) {
              const key = `${cardName}|${baseCode}|${prefixedNumber}`;
              foundCard = cardsByNamePtcgoNumber.get(key);
            }
          }
        }
      }
    }

    // If not found, try stripping parenthetical from card name
    // e.g., "Boss's Orders (Ghetsis) PAL" → "Boss's Orders PAL"
    if (!foundCard) {
      const stripped = middleNorm.replace(/\s*\([^)]*\)/g, '');
      if (stripped !== middleNorm) {
        for (const ptcgoCode of knownPtcgoCodes) {
          if (stripped.endsWith(ptcgoCode)) {
            const cardName = stripped.slice(0, -(ptcgoCode.length)).trim();
            const key = `${cardName}|${ptcgoCode}|${normCardNumber}`;
            foundCard = cardsByNamePtcgoNumber.get(key);
            if (foundCard) break;
          }
        }
        if (!foundCard) {
          for (const setName of knownSets) {
            if (stripped.endsWith(setName)) {
              const cardName = stripped.slice(0, -(setName.length)).trim();
              const key = `${cardName}|${setName}|${normCardNumber}`;
              foundCard = cardsByNameSetNumber.get(key);
              if (foundCard) break;
            }
          }
        }
      }
    }

    // If not found, try prepending "Basic " for energy cards
    // e.g., "Psychic Energy SVE" → "Basic Psychic Energy SVE"
    if (!foundCard && middleNorm.includes('energy')) {
      const lastSpaceIdx = middleNorm.lastIndexOf(' ');
      if (lastSpaceIdx > 0) {
        const code = middleNorm.slice(lastSpaceIdx + 1);
        const cardName = middleNorm.slice(0, lastSpaceIdx).trim();
        const basicName = `basic ${cardName}`;
        const aliasedCode = SET_CODE_ALIASES[code] || code;

        // Try ptcgoCode
        if (knownPtcgoCodes.has(aliasedCode)) {
          const key = `${basicName}|${aliasedCode}|${normCardNumber}`;
          foundCard = cardsByNamePtcgoNumber.get(key);
        }
        // Try full set name
        if (!foundCard && knownSets.has(aliasedCode)) {
          const key = `${basicName}|${aliasedCode}|${normCardNumber}`;
          foundCard = cardsByNameSetNumber.get(key);
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
      warnings.push(`${getCardName(card)}: ${quantity} copies (max 4 allowed)`);
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

    const nameA = getCardName(a.card);
    const nameB = getCardName(b.card);
    return nameA.localeCompare(nameB);
  });

  return cardsWithData;
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
  // Basic Energy cards are exempt from all GLC restrictions
  const isBasicEnergy = cardToAdd.supertype === 'Energy' && cardToAdd.subtypes?.includes('Basic');
  if (isBasicEnergy) {
    return { canAdd: true };
  }

  // Rule 1: Modern series only
  if (!MODERN_SERIES.includes(cardToAdd.series)) {
    return { canAdd: false, reason: 'Card is not from a modern series (Black & White onwards)' };
  }

  // Rule 2: 1 copy per NAME (not per ID)
  const cardName = getCardName(cardToAdd);
  for (const [existingId, qty] of Object.entries(deckCards)) {
    if (qty <= 0) continue;
    const existingCard = cardMap.get(existingId);
    if (!existingCard) continue;

    const existingName = getCardName(existingCard);
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

    // Basic Energy cards are exempt from all GLC restrictions
    const isBasicEnergy = card.supertype === 'Energy' && card.subtypes?.includes('Basic');
    if (isBasicEnergy) continue;

    // Check modern series
    if (!MODERN_SERIES.includes(card.series)) {
      const name = getCardName(card);
      violations.push(`${name} is not from a modern series`);
    }

    // Count card names
    const cardName = getCardName(card);
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
