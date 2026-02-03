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
 * - Future sets appear at the top
 * - Cards without release dates appear at the top
 * - Then sorted newest to oldest
 * Used for search results display
 */
export function sortCardsByReleaseDate(cards: Card[]): Card[] {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');

  return cards.sort((a, b) => {
    if (!a || !b) return 0;

    const aDate = a.releaseDate;
    const bDate = b.releaseDate;

    // Missing dates go to top
    const aHasDate = !!aDate;
    const bHasDate = !!bDate;

    if (!aHasDate && !bHasDate) return 0;
    if (!aHasDate) return -1;
    if (!bHasDate) return 1;

    // Future dates go to top
    const aIsFuture = aDate > today;
    const bIsFuture = bDate > today;

    if (aIsFuture && bIsFuture) {
      // Both future: sort by date (earliest future first, so they appear in upcoming order)
      return aDate.localeCompare(bDate);
    }
    if (aIsFuture) return -1;
    if (bIsFuture) return 1;

    // Both have dates in the past: newest first
    return bDate.localeCompare(aDate);
  });
}
