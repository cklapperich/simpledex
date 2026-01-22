// Card structure from cards-western.json and cards-asia.json
export interface Card {
  id: string;
  names: Record<string, string>; // Multi-language names (e.g., { en: "Pikachu", ja: "ピカチュウ" })
  set: string;
  number: string;
  setNumber?: string; // Combined field for searching "Set Number"
  releaseDate: string; // Format: YYYY/MM/DD
  series: string; // e.g., "Base", "Black & White", "Scarlet & Violet"
  supertype: string; // "Pokémon", "Trainer", or "Energy"
  subtypes: string[]; // e.g., ["Stage 2"], ["Item"], ["Supporter"], ["Basic", "V"]
  types: string[]; // Pokémon types: ["Fire"], ["Water", "Psychic"], etc.
  ptcgoCode?: string; // PTCGO set code (e.g., "TEU", "CEC", "SVE")
  rarity: string; // Card rarity (e.g., "Common", "Rare", "Ultra Rare")
  // NEW METADATA from TCGdex
  hp?: number; // HP for Pokémon cards
  attacks?: Attack[]; // Attacks for Pokémon cards
  abilities?: Ability[]; // Abilities for Pokémon cards
  weaknesses?: Weakness[]; // Weaknesses for Pokémon cards
  resistances?: Resistance[]; // Resistances for Pokémon cards
  retreatCost?: string[]; // Retreat cost (energy types)
  // TCGdex metadata for dynamic URLs (image constructed at runtime)
  seriesId?: string; // TCGdex series ID for constructing image URLs
  setId?: string; // TCGdex set ID for constructing image URLs
}

// Attack structure
export interface Attack {
  name: string;
  cost: string[]; // Energy types required
  damage?: string; // Damage (e.g., "60", "30+", "×")
  effect?: string; // Attack effect description
}

// Ability structure
export interface Ability {
  name: string;
  effect: string; // Ability effect description
  type: string; // Ability type (e.g., "Ability", "Poké-Power", "Poké-Body")
}

// Weakness structure
export interface Weakness {
  type: string; // Energy type
  value?: string; // Weakness modifier (e.g., "×2", "+20")
}

// Resistance structure
export interface Resistance {
  type: string; // Energy type
  value?: string; // Resistance modifier (e.g., "-20", "-30")
}

// Collection format: cardId -> quantity
// Example: { "base1-4": 2, "sv1-25": 1 }
export type Collection = Record<string, number>;

// Result type for collection operations
export interface CollectionResult {
  success: boolean;
  quantity: number;
  error?: 'MAX_QUANTITY' | 'ALREADY_ZERO';
  addedNew?: boolean; // True when adding a card from 0 to 1
}

// Wishlist storage format: cardId -> boolean (only stores cards that ARE on wishlist)
// Example: { "sv1-25": true, "base1-4": true }
export type Wishlist = Record<string, boolean>;

// Operation result for wishlist operations
export interface WishlistResult {
  success: boolean;
  isOnWishlist: boolean;
  error?: string;
  addedNew?: boolean;
  removed?: boolean;
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
