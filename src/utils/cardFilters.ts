import type { Card } from '../types';

/**
 * Checks if a card has a rule box
 * Rule box cards include:
 * - Pokemon: V, VMAX, VSTAR, GX, EX, ex, MEGA, BREAK, TAG TEAM, LV.X, LEGEND, Radiant, Prism Star
 * - Trainers: ACE SPEC cards, Prism Star
 *
 * Explicitly EXCLUDED (not rulebox):
 * - Ancient Trait Pokemon
 * - Prime Pokemon
 */
export function hasRulebox(card: Card): boolean {
  // Check ACE SPEC and Prism Star first (can be any supertype)
  if (card.rarity === 'ACE SPEC Rare' || card.rarity === 'Prism Rare') {
    return true;
  }

  // Only check name/subtype patterns for Pokemon cards
  if (card.supertype === 'Pokemon') {
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

    // Check special rarities
    const ruleboxRarities = ['Rare Holo LV.X', 'LEGEND', 'Radiant Rare'];
    if (ruleboxRarities.includes(card.rarity)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a card is legal in Expanded format (Black & White onwards)
 * Uses EXCLUSION logic: filters OUT old series, automatically includes new series
 * Note: Pokémon TCG Pocket cards are excluded at build time (not included in output)
 */
function isExpandedLegal(card: Card): boolean {
  // Series to exclude (pre-Black & White era only)
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
    // Special sets
    'Trainer kits',
    'data'
  ];

  // Check series exclusion first
  if (excludedSeries.includes(card.series)) {
    return false;
  }

  // Special handling for "Other" series: use date-based filtering
  // "Other" includes both old sets (Best of Game 2002) and modern sets (McDonald's 2011+)
  // Black & White started 2011/11/16, so exclude "Other" cards before 2011/04/01
  if (card.series === 'Other') {
    const releaseDate = card.releaseDate;
    const bwCutoffDate = '2011/04/01'; // Well before Black & White launch
    return releaseDate >= bwCutoffDate;
  }

  return true;
}

/**
 * Checks if a card matches the active filters
 * Filter logic:
 * - Type/category filters (Fire, Water, Trainer, Item, etc.) use OR logic (match any)
 * - Format filters (NoRulebox, ExpandedLegal) use AND logic (match all)
 * - Combined: (match any type/category) AND (match all formats)
 */
export function matchesFilters(card: Card, activeFilters: Set<string>): boolean {
  if (activeFilters.size === 0) return true;

  // Separate filters into categories
  const formatFilters: string[] = [];
  const typeFilters: string[] = [];

  for (const filter of activeFilters) {
    if (filter === 'NoRulebox' || filter === 'ExpandedLegal') {
      formatFilters.push(filter);
    } else {
      typeFilters.push(filter);
    }
  }

  // Check format filters (must match ALL)
  for (const filter of formatFilters) {
    if (filter === 'NoRulebox' && hasRulebox(card)) {
      return false;
    }
    if (filter === 'ExpandedLegal' && !isExpandedLegal(card)) {
      return false;
    }
  }

  // Check type/category filters (must match at least ONE, if any exist)
  if (typeFilters.length > 0) {
    let matchesType = false;

    for (const filter of typeFilters) {
      // Check if it's a type filter (Pokémon energy types)
      if (card.types && card.types.includes(filter)) {
        matchesType = true;
        break;
      }

      // Check if it's a category filter
      if (filter === 'Energy' && card.supertype === 'Energy') {
        matchesType = true;
        break;
      }

      // Check for Trainer supertype (matches all trainer cards)
      if (filter === 'Trainer' && card.supertype === 'Trainer') {
        matchesType = true;
        break;
      }

      // For Trainer subcategories (Item, Supporter, Tool, Stadium)
      if (card.supertype === 'Trainer' && card.subtypes.includes(filter)) {
        matchesType = true;
        break;
      }

      // For Energy subcategories (Special, Normal/Basic)
      if (card.supertype === 'Energy' && card.subtypes.includes(filter)) {
        matchesType = true;
        break;
      }
    }

    if (!matchesType) {
      return false;
    }
  }

  return true;
}

/**
 * Normalizes set name queries for case-insensitive matching
 */
export function normalizeSetName(query: string): string {
  return query.toLowerCase();
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
