import { writable, get } from 'svelte/store';
import type { Deck } from '../types';

const STORAGE_KEY = 'decks';

type DeckStore = Record<string, Deck>; // deckId -> Deck

function createDecksStore() {
  // Load initial data from localStorage
  const initialData = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to load decks from localStorage, using empty store', error);
      return {};
    }
  })();

  const { subscribe, set, update } = writable<DeckStore>(initialData);

  // Auto-save to localStorage on every change
  subscribe(value => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save decks to localStorage', error);
    }
  });

  return {
    subscribe,

    createDeck: (name: string): string => {
      const deckId = `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newDeck: Deck = {
        id: deckId,
        name: name || 'Untitled Deck',
        cards: {}
      };

      update(decks => ({
        ...decks,
        [deckId]: newDeck
      }));

      return deckId;
    },

    deleteDeck: (deckId: string): void => {
      update(decks => {
        const updated = { ...decks };
        delete updated[deckId];
        return updated;
      });
    },

    renameDeck: (deckId: string, newName: string): void => {
      update(decks => {
        if (!decks[deckId]) return decks;
        return {
          ...decks,
          [deckId]: { ...decks[deckId], name: newName }
        };
      });
    },

    addCardToDeck: (deckId: string, cardId: string): void => {
      update(decks => {
        if (!decks[deckId]) return decks;

        const deck = decks[deckId];
        const currentQty = deck.cards[cardId] || 0;

        return {
          ...decks,
          [deckId]: {
            ...deck,
            cards: {
              ...deck.cards,
              [cardId]: currentQty + 1
            }
          }
        };
      });
    },

    removeCardFromDeck: (deckId: string, cardId: string): void => {
      update(decks => {
        if (!decks[deckId]) return decks;

        const deck = decks[deckId];
        const currentQty = deck.cards[cardId] || 0;

        if (currentQty === 0) return decks;

        const newCards = { ...deck.cards };
        if (currentQty === 1) {
          delete newCards[cardId];
        } else {
          newCards[cardId] = currentQty - 1;
        }

        return {
          ...decks,
          [deckId]: {
            ...deck,
            cards: newCards
          }
        };
      });
    },

    setCardQuantity: (deckId: string, cardId: string, quantity: number): void => {
      update(decks => {
        if (!decks[deckId]) return decks;

        const deck = decks[deckId];
        const newCards = { ...deck.cards };

        if (quantity <= 0) {
          delete newCards[cardId];
        } else {
          newCards[cardId] = quantity;
        }

        return {
          ...decks,
          [deckId]: {
            ...deck,
            cards: newCards
          }
        };
      });
    },

    getDeck: (deckId: string): Deck | undefined => {
      return get({ subscribe })[deckId];
    },

    importDeck: (deckData: Deck): void => {
      update(decks => ({
        ...decks,
        [deckData.id]: deckData
      }));
    }
  };
}

export const decks = createDecksStore();
