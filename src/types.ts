// Card structure from cards.json
export interface Card {
  id: string;
  name: string;
  set: string;
  number: string;
  image: string;
  setNumber?: string; // Combined field for searching "Set Number"
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
