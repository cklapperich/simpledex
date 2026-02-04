// Regex patterns for card ID normalization
const DOT_REMOVAL = /\./g;
const PT_NOTATION = /pt/g;
const CELEBRATIONS_CLASSIC = /^cel25c$/;
const LEADING_ZEROS_IN_SET = /([a-z]+)0+(\d+)/g;
// Subset suffixes that should be removed from set IDs:
// - gg = Galarian Gallery (e.g., swsh12pt5gg)
// - tg = Trainer Gallery (e.g., swsh9tg, swsh10tg, swsh11tg, swsh12tg)
// - sv = Shiny Vault (e.g., swsh45sv for Shining Fates Shiny Vault)
// - rc = Radiant Collection (legacy, kept for compatibility)
const SUBSET_SUFFIXES = /(gg|tg|rc|sv)$/;
const LEADING_ZEROS = /^([A-Z]*)0+(\d+.*)$/;
const VARIANT_UNDERSCORE = /_([A-Z])/g;
const TRAILING_VARIANT_ONE = /(\d+[A-Z])1$/;

/**
 * Normalize card ID for matching between databases
 * Handles variations like:
 * - Dots: sm7.5 vs sm75
 * - "pt" notation: swsh12.5 vs swsh12pt5
 * - Leading zeros in set numbers: sv01 vs sv1
 * - Leading zeros in card numbers: 099 vs 99, H08 -> H8, SM09 -> SM9
 * - Subset suffixes: swsh125gg vs swsh125, swsh12tg -> swsh12
 * - Celebrations variants: cel25c vs cel25
 * - Variant underscores: 15_A vs 15A
 * - Trailing variant digits: 15A1 vs 15A (tcgdex duplicates)
 */
export function normalizeCardId(id: string): string {
  // Split into set ID and card number
  const parts = id.split('-');
  if (parts.length < 2) return id;

  let setId = parts[0];
  let cardNumber = parts.slice(1).join('-');

  // Remove dots from set ID
  setId = setId.replace(DOT_REMOVAL, '');

  // Convert "pt" notation to match (swsh12pt5 -> swsh125)
  setId = setId.replace(PT_NOTATION, '');

  // Normalize Celebrations Classic Collection: cel25c -> cel25
  setId = setId.replace(CELEBRATIONS_CLASSIC, 'cel25');

  // Remove leading zeros from numbers in set ID (sv01 -> sv1, swsh03 -> swsh3)
  // But keep the letters and only remove zeros from the numeric part
  setId = setId.replace(LEADING_ZEROS_IN_SET, '$1$2');

  // Remove subset suffixes (gg = Galarian Gallery, tg = Trainer Gallery, rc = Radiant Collection, sv = Shiny Vault)
  // Examples: swsh125gg -> swsh125, swsh12tg -> swsh12, swsh45sv -> swsh45
  setId = setId.replace(SUBSET_SUFFIXES, '');

  // Remove leading zeros from card number (004 -> 4, 099 -> 99, H08 -> H8, SM09 -> SM9)
  // Preserves variant suffixes like _A1, _B2
  cardNumber = cardNumber.replace(LEADING_ZEROS, '$1$2');

  // Remove underscores from variant suffixes (15_A1 -> 15A1)
  cardNumber = cardNumber.replace(VARIANT_UNDERSCORE, '$1');

  // Remove trailing "1" after variant letters ONLY (15A1 -> 15A)
  // This handles tcgdex duplicates where 15A and 15A1 are the same card
  // But preserves 15A2, 15A3, 15A4 as different cards
  // Only matches patterns with digits before the letter (15A1), not standalone letters (H1)
  cardNumber = cardNumber.replace(TRAILING_VARIANT_ONE, '$1');

  return `${setId}-${cardNumber}`;
}

// Mapping for filesystem-safe conversions (bidirectional)
const FILESYSTEM_CHAR_MAP: Record<string, string> = {
  '!': '_excl_',
  '?': '_qmark_',
  '*': '_star_',
  '<': '_lt_',
  '>': '_gt_',
  '"': '_quot_',
  '|': '_pipe_',
  '\\': '_bslash_',
  '/': '_slash_',
  ':': '_colon_',
  '%': '_pct_',
};

const FILESYSTEM_REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(FILESYSTEM_CHAR_MAP).map(([k, v]) => [v, k])
);

/**
 * Convert a card ID to a filesystem-safe filename (without extension)
 * ex10-! -> ex10-_excl_
 * ex10-? -> ex10-_qmark_
 * exu-%3F -> exu-_qmark_ (URL-decodes first)
 */
export function cardIdToFilename(id: string): string {
  // URL-decode first (handles %3F -> ?, %21 -> !, etc.)
  let result: string;
  try {
    result = decodeURIComponent(id);
  } catch {
    result = id;
  }

  for (const [char, replacement] of Object.entries(FILESYSTEM_CHAR_MAP)) {
    result = result.split(char).join(replacement);
  }
  return result;
}

/**
 * Convert a filesystem filename back to a card ID
 * ex10-_excl_ -> ex10-!
 * ex10-_qmark_ -> ex10-?
 */
export function filenameToCardId(filename: string): string {
  let result = filename;
  for (const [replacement, char] of Object.entries(FILESYSTEM_REVERSE_MAP)) {
    result = result.split(replacement).join(char);
  }
  return result;
}
