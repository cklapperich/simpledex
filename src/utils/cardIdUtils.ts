/**
 * Normalize card ID for matching between databases
 * Handles variations like:
 * - Dots: sm7.5 vs sm75
 * - "pt" notation: swsh12.5 vs swsh12pt5
 * - Leading zeros: sv01 vs sv1
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
  setId = setId.replace(/\./g, '');

  // Convert "pt" notation to match (swsh12pt5 -> swsh125)
  setId = setId.replace(/pt/g, '');

  // Normalize Celebrations Classic Collection: cel25c -> cel25
  setId = setId.replace(/^cel25c$/, 'cel25');

  // Remove leading zeros from numbers in set ID (sv01 -> sv1, swsh03 -> swsh3)
  // But keep the letters and only remove zeros from the numeric part
  setId = setId.replace(/([a-z]+)0+(\d+)/g, '$1$2');

  // Remove subset suffixes (gg = Galarian Gallery, tg = Trainer Gallery, rc = Radiant Collection, sv = Shiny Vault)
  // Examples: swsh125gg -> swsh125, swsh12tg -> swsh12, swsh45sv -> swsh45
  setId = setId.replace(/(gg|tg|rc|sv)$/, '');

  // Remove leading zeros from card number (004 -> 4, 099 -> 99)
  // Preserves variant suffixes like _A1, _B2
  cardNumber = cardNumber.replace(/^0+(\d.*)/, '$1');

  // Remove underscores from variant suffixes (15_A1 -> 15A1)
  cardNumber = cardNumber.replace(/_([A-Z])/g, '$1');

  // Remove trailing "1" after variant letters ONLY (15A1 -> 15A)
  // This handles tcgdex duplicates where 15A and 15A1 are the same card
  // But preserves 15A2, 15A3, 15A4 as different cards
  cardNumber = cardNumber.replace(/([A-Z])1$/, '$1');

  return `${setId}-${cardNumber}`;
}
