import type { Card } from '../types';
import { DEFAULT_LANGUAGE } from '../constants';

/**
 * Constructs language-specific image URL for a card
 * @param card - The card to get the image for
 * @param language - The language code (e.g., 'en', 'fr', 'de', 'it')
 * @returns Primary image URL (tries pokemon-tcg-data first, then tcgdex backup)
 *
 * Note: Not all cards have images in all languages. Older sets may only have EN/FR.
 * If image doesn't exist (404), CardItem will show grey fallback UI.
 */
export function getCardImageUrl(card: Card, language: string = DEFAULT_LANGUAGE): string {
  // Return first available image URL (pokemon-tcg-io preferred, stored first in array)
  if (card.images && card.images.length > 0) {
    return card.images[0].url;
  }

  // Fallback: construct URL from card metadata
  if (card.seriesId && card.setId && card.number) {
    return `https://assets.tcgdex.net/${language}/${card.seriesId}/${card.setId}/${card.number}/low.webp`;
  }

  return '';
}

/**
 * Get all available image URLs for a card (primary and backups)
 * @param card - The card to get images for
 * @param language - The language code (e.g., 'en', 'fr', 'de', 'it')
 * @returns Array of all available image URLs, ordered by priority
 */
export function getAllCardImageUrls(card: Card, language: string = DEFAULT_LANGUAGE): string[] {
  // Return all image URLs directly (already stored as full URLs)
  if (card.images && card.images.length > 0) {
    return card.images.map(img => img.url);
  }

  // Fallback: construct URL from card metadata
  if (card.seriesId && card.setId && card.number) {
    return [`https://assets.tcgdex.net/${language}/${card.seriesId}/${card.setId}/${card.number}/low.webp`];
  }

  return [];
}
