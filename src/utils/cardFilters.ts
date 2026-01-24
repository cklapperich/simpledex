import type { Card } from '../types';

/**
 * Checks if a card has a rule box
 * Rule box cards include:
 * - Pokemon: V, VMAX, VSTAR, GX, EX, ex, MEGA, BREAK, TAG TEAM, LV.X, LEGEND
 * - Trainers: ACE SPEC cards
 *
 * Explicitly EXCLUDED (not rulebox per user):
 * - Radiant Pokemon
 * - Ancient Trait Pokemon
 * - Prime Pokemon
 */
function hasRulebox(card: Card): boolean {
  // Check ACE SPEC trainers first (user requirement: filter these out)
  if (card.rarity === 'ACE SPEC Rare') {
    return true;
  }

  // Only check name/subtype patterns for Pokemon cards
  if (card.supertype === 'Pokémon') {
    const name = card.names.en || Object.values(card.names)[0];

    // Handle edge case where names might be empty
    if (!name) {
      return false;
    }

    // Check name patterns
    if (name.endsWith(' V') ||
        name.endsWith(' VMAX') ||
        name.endsWith(' VSTAR') ||
        name.endsWith(' GX') ||
        name.endsWith(' EX') ||
        name.endsWith(' ex') ||
        name.includes(' & ')) {  // TAG TEAM
      return true;
    }

    // Check subtypes
    const ruleboxSubtypes = ['MEGA', 'BREAK', 'VMAX', 'VSTAR'];
    if (card.subtypes.some(subtype => ruleboxSubtypes.includes(subtype))) {
      return true;
    }

    // Check special rarities (Radiant and Prime removed per user request)
    const ruleboxRarities = ['Rare Holo LV.X', 'LEGEND'];
    if (ruleboxRarities.includes(card.rarity)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a card is legal in Expanded format (Black & White onwards)
 * Uses EXCLUSION logic: filters OUT old series, automatically includes new series
 */
function isExpandedLegal(card: Card): boolean {
  // Series to exclude (pre-Black & White era + special sets)
  const excludedSeries = [
    // Pre-BW era
    'Base',
    'Gym',
    'Legendary Collection',
    'Neo',
    'E-Card',
    'EX',
    'POP',
    'Diamond & Pearl',
    'Platinum',
    'HeartGold & SoulSilver',
    'Call of Legends',
    // Special/promotional sets
    'McDonald\'s Collection',
    'Trainer kits',
    'Pokémon TCG Pocket',
    'data'
  ];

  return !excludedSeries.includes(card.series);
}

/**
 * Checks if a card matches any of the active filters
 * Filters can be:
 * - Pokemon energy types (Fire, Water, Grass, etc.)
 * - Card categories (Energy, Trainer)
 * - Trainer subcategories (Item, Supporter, Tool)
 * - Format filters (NoRulebox, ExpandedLegal)
 */
export function matchesFilters(card: Card, activeFilters: Set<string>): boolean {
  if (activeFilters.size === 0) return true;

  // Check each active filter
  for (const filter of activeFilters) {
    // NEW: No rulebox filter
    if (filter === 'NoRulebox' && !hasRulebox(card)) {
      return true;
    }

    // NEW: Expanded legal filter
    if (filter === 'ExpandedLegal' && isExpandedLegal(card)) {
      return true;
    }

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

/**
 * Save filters to localStorage
 */
export function saveFilters(filterKey: string, filters: Set<string>): void {
  try {
    localStorage.setItem(filterKey, JSON.stringify(Array.from(filters)));
  } catch (error) {
    console.error('Failed to save filters:', error);
  }
}

/**
 * Load filters from localStorage
 */
export function loadFilters(filterKey: string): Set<string> {
  try {
    const saved = localStorage.getItem(filterKey);
    if (saved) {
      return new Set(JSON.parse(saved));
    }
  } catch (error) {
    console.error('Failed to load filters:', error);
  }
  return new Set();
}
