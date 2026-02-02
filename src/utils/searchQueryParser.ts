/**
 * Search query parser for structured filter syntax
 * Supports queries like: "artist:sowsow pikachu" or "artist:"Ken Sugimori" charizard"
 * Also supports negation with "-" prefix: "-type:fire" excludes fire types
 */

export interface FilterValue {
  value: string;
  negated: boolean;
}

export interface SearchFilters {
  artist?: FilterValue[]; // artist:value or illustrator:value
  type?: FilterValue[];   // Pokemon types OR trainer subtypes
  text?: FilterValue[];   // Game mechanic text (attacks, abilities, rules)
  flavor?: FilterValue[]; // Pokedex flavor text
  has?: FilterValue[];    // Property checks (e.g., has:rule_box)
  set?: FilterValue[];    // Set name or PTCGO code (e.g., set:BS, set:"Base Set")
}

export interface ParsedSearchQuery {
  text: string; // Remaining text for name/set search
  filters: SearchFilters; // Extracted filter values
}

// Regex to match filter:value or filter:"quoted value" with optional "-" prefix for negation
// Captures: group 1 = optional "-", group 2 = filter name, group 3 = quoted value, group 4 = unquoted value
const FILTER_REGEX = /(-?)(\w+):(?:"([^"]+)"|(\S+))/g;

// Alias mapping for filter names
const FILTER_ALIASES: Record<string, keyof SearchFilters> = {
  artist: 'artist',
  illustrator: 'artist',
  type: 'type',
  text: 'text',
  flavor: 'flavor',
  flavortext: 'flavor',  // alias
  has: 'has',
  set: 'set',
  expansion: 'set',  // alias
};

/**
 * Parse a search query into structured filters and remaining text
 * @param query The raw search query string
 * @returns Parsed query with filters extracted
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const filters: SearchFilters = {};
  let remainingText = query;

  // Find all filter:value patterns
  let match: RegExpExecArray | null;
  const matchesToRemove: string[] = [];

  while ((match = FILTER_REGEX.exec(query)) !== null) {
    const [fullMatch, negation, filterName, quotedValue, unquotedValue] = match;
    const value = quotedValue || unquotedValue;
    const normalizedFilter = FILTER_ALIASES[filterName.toLowerCase()];
    const isNegated = negation === '-';

    if (normalizedFilter && value) {
      // Initialize array if needed
      if (!filters[normalizedFilter]) {
        filters[normalizedFilter] = [];
      }
      filters[normalizedFilter]!.push({ value, negated: isNegated });
      matchesToRemove.push(fullMatch);
    }
  }

  // Remove matched filters from the text
  for (const toRemove of matchesToRemove) {
    remainingText = remainingText.replace(toRemove, '');
  }

  // Clean up remaining text (collapse multiple spaces, trim)
  remainingText = remainingText.replace(/\s+/g, ' ').trim();

  return {
    text: remainingText,
    filters,
  };
}

/**
 * Check if a query contains any structured filters
 */
export function hasFilters(filters: SearchFilters): boolean {
  return Object.values(filters).some(arr => arr && arr.length > 0);
}
