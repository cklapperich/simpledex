import { writable, get } from 'svelte/store';
import type { Deck } from '../types';
import { user } from './auth';
import {
  loadDecksFromSupabase,
  saveDeckToSupabase,
  deleteDeckFromSupabase,
  mergeDecks
} from '../utils/decksSync';
import { STORAGE_KEYS } from '../constants';

type DeckStore = Record<string, Deck>; // deckId -> Deck

// Module-level state for tracking current user and sync status
let currentUserId: string | null = null;
let isSyncing = false;

// Store for sync errors that can be displayed in UI
export const deckSyncError = writable<string | null>(null);

function createDecksStore() {
  // Load initial data from localStorage
  const initialData = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DECKS);
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
      localStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save decks to localStorage', error);
    }
  });

  // Helper function to sync a single deck to Supabase
  async function syncDeckToSupabase(deck: Deck) {
    if (!currentUserId || isSyncing) return;

    try {
      deckSyncError.set(null);
      const result = await saveDeckToSupabase(currentUserId, deck);

      if (!result.success) {
        deckSyncError.set(result.error || 'Deck sync failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('[Decks] Error syncing to Supabase:', error);
      deckSyncError.set(message);
    }
  }

  // Helper function to delete a deck from Supabase
  async function deleteDeckFromSupabaseAsync(deckId: string) {
    if (!currentUserId || isSyncing) return;

    try {
      deckSyncError.set(null);
      const result = await deleteDeckFromSupabase(currentUserId, deckId);

      if (!result.success) {
        deckSyncError.set(result.error || 'Failed to delete deck from cloud');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('[Decks] Error deleting from Supabase:', error);
      deckSyncError.set(message);
    }
  }

  // Handle user login - merge localStorage with Supabase
  async function handleLogin(userId: string) {
    if (isSyncing) return;
    isSyncing = true;

    try {
      deckSyncError.set(null);
      const localDecks = get({ subscribe });

      // Merge localStorage into Supabase
      const mergeResult = await mergeDecks(userId, localDecks);

      if (!mergeResult.success) {
        deckSyncError.set(mergeResult.error || 'Failed to merge decks');
      }

      // Update store with merged decks
      set(mergeResult.merged);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown login sync error';
      console.error('[Decks] Error during login sync:', error);
      deckSyncError.set(message);
    } finally {
      isSyncing = false;
    }
  }

  // Handle user logout - keep localStorage, stop syncing
  function handleLogout() {
    currentUserId = null;
    deckSyncError.set(null);
  }

  // Subscribe to user changes
  user.subscribe(async ($user) => {
    const newUserId = $user?.id || null;
    console.log('[Decks] User subscription fired. User ID:', newUserId, 'Current user ID:', currentUserId);

    if (newUserId && newUserId !== currentUserId) {
      // User just logged in
      console.log('[Decks] User logged in, calling handleLogin');
      currentUserId = newUserId;
      await handleLogin(newUserId);
    } else if (!newUserId && currentUserId) {
      // User just logged out
      console.log('[Decks] User logged out');
      handleLogout();
    } else {
      console.log('[Decks] No user state change to handle');
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

      // Sync to Supabase asynchronously (non-blocking)
      if (currentUserId) {
        syncDeckToSupabase(newDeck);
      }

      return deckId;
    },

    deleteDeck: (deckId: string): void => {
      update(decks => {
        const updated = { ...decks };
        delete updated[deckId];
        return updated;
      });

      // Delete from Supabase asynchronously (non-blocking)
      if (currentUserId) {
        deleteDeckFromSupabaseAsync(deckId);
      }
    },

    renameDeck: (deckId: string, newName: string): void => {
      let updatedDeck: Deck | null = null;

      update(decks => {
        if (!decks[deckId]) return decks;
        updatedDeck = { ...decks[deckId], name: newName };
        return {
          ...decks,
          [deckId]: updatedDeck
        };
      });

      // Sync to Supabase asynchronously (non-blocking)
      if (currentUserId && updatedDeck) {
        syncDeckToSupabase(updatedDeck);
      }
    },

    setStrategy: (deckId: string, strategy: string): void => {
      let updatedDeck: Deck | null = null;

      update(decks => {
        if (!decks[deckId]) return decks;
        updatedDeck = { ...decks[deckId], strategy };
        return {
          ...decks,
          [deckId]: updatedDeck
        };
      });

      if (currentUserId && updatedDeck) {
        syncDeckToSupabase(updatedDeck);
      }
    },

    addCardToDeck: (deckId: string, cardId: string): void => {
      let updatedDeck: Deck | null = null;

      update(decks => {
        if (!decks[deckId]) return decks;

        const deck = decks[deckId];
        const currentQty = deck.cards[cardId] || 0;

        updatedDeck = {
          ...deck,
          cards: {
            ...deck.cards,
            [cardId]: currentQty + 1
          }
        };

        return {
          ...decks,
          [deckId]: updatedDeck
        };
      });

      // Sync to Supabase asynchronously (non-blocking)
      if (currentUserId && updatedDeck) {
        syncDeckToSupabase(updatedDeck);
      }
    },

    removeCardFromDeck: (deckId: string, cardId: string): void => {
      let updatedDeck: Deck | null = null;

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

        updatedDeck = {
          ...deck,
          cards: newCards
        };

        return {
          ...decks,
          [deckId]: updatedDeck
        };
      });

      // Sync to Supabase asynchronously (non-blocking)
      if (currentUserId && updatedDeck) {
        syncDeckToSupabase(updatedDeck);
      }
    },

    setCardQuantity: (deckId: string, cardId: string, quantity: number): void => {
      let updatedDeck: Deck | null = null;

      update(decks => {
        if (!decks[deckId]) return decks;

        const deck = decks[deckId];
        const newCards = { ...deck.cards };

        if (quantity <= 0) {
          delete newCards[cardId];
        } else {
          newCards[cardId] = quantity;
        }

        updatedDeck = {
          ...deck,
          cards: newCards
        };

        return {
          ...decks,
          [deckId]: updatedDeck
        };
      });

      // Sync to Supabase asynchronously (non-blocking)
      if (currentUserId && updatedDeck) {
        syncDeckToSupabase(updatedDeck);
      }
    },

    getDeck: (deckId: string): Deck | undefined => {
      return get({ subscribe })[deckId];
    },

    importDeck: (deckData: Deck): void => {
      update(decks => ({
        ...decks,
        [deckData.id]: deckData
      }));

      // Sync to Supabase asynchronously (non-blocking)
      if (currentUserId) {
        syncDeckToSupabase(deckData);
      }
    }
  };
}

export const decks = createDecksStore();
