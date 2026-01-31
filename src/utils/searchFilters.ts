/**
 * Search filter matching utilities
 * Applies parsed filters to card data
 */

import type { Card } from '../types';
import type { SearchFilters } from './searchQueryParser';

/**
 * Check if a card matches the given search filters
 * - Multiple values within same filter type use OR logic (artist:ken artist:mitsuhiro)
 * - Different filter types use AND logic (future: artist:ken type:Fire)
 * @param card The card to check
 * @param filters The parsed search filters
 * @returns true if the card matches all filter criteria
 */
export function matchesSearchFilters(card: Card, filters: SearchFilters): boolean {
  // Check artist filter (OR logic within multiple values)
  if (filters.artist && filters.artist.length > 0) {
    const cardArtist = card.illustrator?.toLowerCase() || '';

    // Card must match at least one of the artist values (OR logic)
    const matchesArtist = filters.artist.some(artist =>
      cardArtist.includes(artist.toLowerCase())
    );

    if (!matchesArtist) {
      return false;
    }
  }

  // Future filters would be added here with AND logic between different types
  // Example:
  // if (filters.type && filters.type.length > 0) {
  //   const matchesType = filters.type.some(type =>
  //     card.types.some(t => t.toLowerCase().includes(type.toLowerCase()))
  //   );
  //   if (!matchesType) return false;
  // }

  return true;
}
