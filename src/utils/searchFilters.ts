/**
 * Search filter matching utilities
 * Applies parsed filters to card data
 */

import type { Card } from '../types';
import type { SearchFilters, FilterValue } from './searchQueryParser';
import { hasRulebox } from './cardFilters';

/**
 * Build a text blob of all game mechanic text (attacks, abilities, rules)
 * Excludes flavor text (Pokedex entries) for targeted searching
 */
function getMechanicText(card: Card): string {
  const parts: string[] = [];

  // Attack names and effects
  card.attacks?.forEach(a => {
    parts.push(a.name);
    if (a.effect) parts.push(a.effect);
  });

  // Ability names and effects
  card.abilities?.forEach(a => {
    parts.push(a.name);
    parts.push(a.effect);
  });

  // Trainer/Energy rules
  if (card.rules) parts.push(...card.rules);

  return parts.join(' ').toLowerCase();
}

/**
 * Helper to check filter matches with negation support
 * - Positive filters use OR logic (at least one must match)
 * - Negative filters use AND logic (all must NOT match)
 */
function checkFilter(
  filterValues: FilterValue[],
  matchFn: (value: string) => boolean
): boolean {
  const positive = filterValues.filter(f => !f.negated);
  const negative = filterValues.filter(f => f.negated);

  // If there are positive filters, at least one must match (OR logic)
  if (positive.length > 0) {
    const hasPositiveMatch = positive.some(f => matchFn(f.value));
    if (!hasPositiveMatch) return false;
  }

  // All negative filters must NOT match (AND logic for exclusions)
  if (negative.length > 0) {
    const hasNegativeMatch = negative.some(f => matchFn(f.value));
    if (hasNegativeMatch) return false;
  }

  return true;
}

/**
 * Check if a card matches the given search filters
 * - Multiple values within same filter type use OR logic (artist:ken artist:mitsuhiro)
 * - Different filter types use AND logic (future: artist:ken type:Fire)
 * @param card The card to check
 * @param filters The parsed search filters
 * @returns true if the card matches all filter criteria
 */
export function matchesSearchFilters(card: Card, filters: SearchFilters): boolean {
  // Check artist filter
  if (filters.artist && filters.artist.length > 0) {
    const cardArtist = card.illustrator?.toLowerCase() || '';
    const matches = checkFilter(filters.artist, (value) =>
      cardArtist.includes(value.toLowerCase())
    );
    if (!matches) return false;
  }

  // Check type filter (Pokemon types OR trainer subtypes)
  if (filters.type && filters.type.length > 0) {
    const matches = checkFilter(filters.type, (searchType) => {
      const typeLower = searchType.toLowerCase();
      // Check Pokemon types (Fire, Water, etc.)
      const hasType = card.types?.some(t => t.toLowerCase() === typeLower);
      // Check subtypes (Item, Supporter, Stadium, etc.)
      const hasSubtype = card.subtypes?.some(s => s.toLowerCase() === typeLower);
      return hasType || hasSubtype;
    });
    if (!matches) return false;
  }

  // Check text filter (game mechanic text: attacks, abilities, rules)
  if (filters.text && filters.text.length > 0) {
    const mechanicText = getMechanicText(card);
    const matches = checkFilter(filters.text, (term) =>
      mechanicText.includes(term.toLowerCase())
    );
    if (!matches) return false;
  }

  // Check flavor filter (Pokedex flavor text only)
  if (filters.flavor && filters.flavor.length > 0) {
    const flavorText = (card.flavorText || '').toLowerCase();
    const matches = checkFilter(filters.flavor, (term) =>
      flavorText.includes(term.toLowerCase())
    );
    if (!matches) return false;
  }

  // Check has filter (property checks like has:rule_box)
  if (filters.has && filters.has.length > 0) {
    const hasProperty = (prop: string): boolean => {
      if (prop === 'rule_box') {
        return hasRulebox(card);
      }
      return false; // Unknown property
    };

    const matches = checkFilter(filters.has, hasProperty);
    if (!matches) return false;
  }

  return true;
}
