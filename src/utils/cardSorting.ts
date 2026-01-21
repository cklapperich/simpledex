import type { Card } from '../types';

/**
 * Sorts cards by set name (alphabetically), then by card number (numerically)
 * This is the standard sort order for displaying collections and exports
 */
export function sortCardsBySetAndNumber(cards: Card[]): Card[] {
  return cards.sort((a, b) => {
    // Handle undefined cards or properties
    if (!a || !b) return 0;
    if (!a.set || !b.set) return 0;

    // First compare by set name (alphabetical)
    const setCompare = a.set.localeCompare(b.set);
    if (setCompare !== 0) return setCompare;

    // Then compare by card number (numeric if possible)
    if (!a.number || !b.number) return 0;
    const aNum = parseInt(a.number);
    const bNum = parseInt(b.number);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }

    // Fallback to string comparison for special numbers (like "GX", "V", etc.)
    return a.number.localeCompare(b.number);
  });
}

/**
 * Sorts cards by release date (newest first)
 * Used for search results display
 */
export function sortCardsByReleaseDate(cards: Card[]): Card[] {
  return cards.sort((a, b) => {
    if (!a || !b || !a.releaseDate || !b.releaseDate) return 0;
    return b.releaseDate.localeCompare(a.releaseDate);
  });
}
