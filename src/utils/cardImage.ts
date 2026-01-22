import type { Card } from '../types';
import { DEFAULT_LANGUAGE } from '../constants';

/**
 * Constructs image URL for a card using TCGdex CDN
 * Note: TCGdex only serves images from the /en/ path regardless of card language
 * @param card - The card to get the image for
 * @param language - The language code (unused, kept for API compatibility)
 * @returns Image URL (always using 'en' path)
 */
export function getCardImageUrl(card: Card, language: string = DEFAULT_LANGUAGE): string {
  // Construct URL from card metadata
  // Always use 'en' because TCGdex doesn't have language-specific images
  if (card.seriesId && card.setId && card.number) {
    return `https://assets.tcgdex.net/en/${card.seriesId}/${card.setId}/${card.number}/low.webp`;
  }

  // Return empty string if metadata is missing (image error will be handled in CardItem)
  return '';
}
