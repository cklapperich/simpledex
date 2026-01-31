/**
 * Search query parser for structured filter syntax
 * Supports queries like: "artist:sowsow pikachu" or "artist:"Ken Sugimori" charizard"
 */

export interface SearchFilters {
  artist?: string[]; // artist:value or illustrator:value
  // Future filters: set?, type?, series?, hp?, text?, rarity?
}

export interface ParsedSearchQuery {
  text: string; // Remaining text for name/set search
  filters: SearchFilters; // Extracted filter values
}

// Regex to match filter:value or filter:"quoted value"
// Captures: group 1 = filter name, group 2 = quoted value, group 3 = unquoted value
const FILTER_REGEX = /(\w+):(?:"([^"]+)"|(\S+))/g;

// Alias mapping for filter names
const FILTER_ALIASES: Record<string, keyof SearchFilters> = {
  artist: 'artist',
  illustrator: 'artist',
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
    const [fullMatch, filterName, quotedValue, unquotedValue] = match;
    const value = quotedValue || unquotedValue;
    const normalizedFilter = FILTER_ALIASES[filterName.toLowerCase()];

    if (normalizedFilter && value) {
      // Initialize array if needed
      if (!filters[normalizedFilter]) {
        filters[normalizedFilter] = [];
      }
      filters[normalizedFilter]!.push(value);
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
