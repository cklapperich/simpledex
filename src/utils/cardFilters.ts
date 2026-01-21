import type { Card } from '../types';

/**
 * Checks if a card matches any of the active filters
 * Filters can be:
 * - Pokemon energy types (Fire, Water, Grass, etc.)
 * - Card categories (Energy, Trainer)
 * - Trainer subcategories (Item, Supporter, Tool)
 */
export function matchesFilters(card: Card, activeFilters: Set<string>): boolean {
  if (activeFilters.size === 0) return true;

  // Check each active filter
  for (const filter of activeFilters) {
    // Check if it's a type filter (Pokémon energy types)
    if (card.types && card.types.includes(filter)) {
      return true;
    }

    // Check if it's a category filter
    if (filter === 'Energy' && card.supertype === 'Energy') {
      return true;
    }

    // Check for Trainer supertype (matches all trainer cards)
    if (filter === 'Trainer' && card.supertype === 'Trainer') {
      return true;
    }

    // For Trainer subcategories (Item, Supporter, Tool)
    if (card.supertype === 'Trainer' && card.subtypes.includes(filter)) {
      return true;
    }
  }

  return false;
}

/**
 * Handles common set name aliases for better search experience
 * For example, users might search "base set" when the actual name is "Base"
 */
export function normalizeSetName(query: string): string {
  const queryLower = query.toLowerCase();

  // Handle common set name aliases
  if (queryLower === 'base set') {
    return 'base';
  }

  return queryLower;
}
