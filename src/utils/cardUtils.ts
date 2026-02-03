import type { Card } from '../types';
import { DEFAULT_LANGUAGE } from '../constants';

/**
 * Get the localized name for a card
 * Falls back to any available language if the requested language is not available
 */
export function getCardName(card: Card, language: string = DEFAULT_LANGUAGE): string {
  return card.names[language] || card.names[Object.keys(card.names)[0]] || 'Unknown';
}
