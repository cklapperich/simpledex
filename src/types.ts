// Card structure from cards.json
export interface Card {
  id: string;
  name: string;
  set: string;
  number: string;
  image: string;
  setNumber?: string; // Combined field for searching "Set Number"
  releaseDate: string; // Format: YYYY/MM/DD
  series: string; // e.g., "Base", "Black & White", "Scarlet & Violet"
  supertype: string; // "Pokémon", "Trainer", or "Energy"
  subtypes: string[]; // e.g., ["Stage 2"], ["Item"], ["Supporter"], ["Basic", "V"]
  types: string[]; // Pokémon types: ["Fire"], ["Water", "Psychic"], etc.
  ptcgoCode?: string; // PTCGO set code (e.g., "TEU", "CEC", "SVE")
}

// Collection format: cardId -> quantity
// Example: { "base1-4": 2, "sv1-25": 1 }
export type Collection = Record<string, number>;

// Result type for collection operations
export interface CollectionResult {
  success: boolean;
  quantity: number;
  error?: 'MAX_QUANTITY' | 'ALREADY_ZERO';
}

// Enriched card with quantity for exports
export interface EnrichedCard extends Card {
  quantity: number;
}

// Import result structure
export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  detailedErrors?: ImportError[];
}

// Detailed error information for imports
export interface ImportError {
  line?: number;
  cardId?: string;
  cardName?: string;
  message: string;
  type: 'parsing' | 'validation' | 'quantity';
}

// Deck structure
export interface Deck {
  id: string;
  name: string;
  cards: Record<string, number>; // cardId -> quantity (same as Collection)
}

// Deck validation result
export interface DeckValidation {
  isValid: boolean;
  cardCount: number;
  warnings: string[];
}
