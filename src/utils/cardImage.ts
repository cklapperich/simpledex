import type { Card } from '../types';
import { DEFAULT_LANGUAGE } from '../constants';

/**
 * Constructs language-specific image URL for a card using TCGdex CDN
 * @param card - The card to get the image for
 * @param language - The language code (e.g., 'en', 'fr', 'de', 'it')
 * @returns Language-specific image URL
 *
 * Note: Not all cards have images in all languages. Older sets may only have EN/FR.
 * If image doesn't exist (404), CardItem will show grey fallback UI.
 */
export function getCardImageUrl(card: Card, language: string = DEFAULT_LANGUAGE): string {
  // Construct URL from card metadata using the selected language
  if (card.seriesId && card.setId && card.number) {
    return `https://assets.tcgdex.net/${language}/${card.seriesId}/${card.setId}/${card.number}/low.webp`;
  }

  // Return empty string if metadata is missing (image error will be handled in CardItem)
  return '';
}
