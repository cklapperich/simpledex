import { writable, derived, get } from 'svelte/store';
import type { Collection, CollectionResult } from '../types';
import { user } from './auth';
import { loadFromSupabase, saveToSupabase, deleteFromSupabase, mergeCollections, syncFullCollection } from '../utils/collectionSync';

const STORAGE_KEY = 'collection';
const MAX_QUANTITY = 99;

// Module-level state for tracking current user and sync status
let currentUserId: string | null = null;
let isSyncing = false;

function createCollectionStore() {
  // Load initial data from localStorage
  const initialData = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to load collection from localStorage, using empty collection', error);
      return {};
    }
  })();

  const { subscribe, set, update } = writable<Collection>(initialData);

  // Auto-save to localStorage on every change
  subscribe(value => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save collection to localStorage', error);
    }
  });

  // Helper function to sync a single card to Supabase
  async function syncToSupabase(cardId: string, quantity: number) {
    if (!currentUserId || isSyncing) return;

    try {
      if (quantity === 0) {
        await deleteFromSupabase(currentUserId, cardId);
      } else {
        await saveToSupabase(currentUserId, cardId, quantity);
      }
    } catch (error) {
      console.error('Error syncing to Supabase:', error);
    }
  }

  // Handle user login - merge localStorage with Supabase
  async function handleLogin(userId: string) {
    if (isSyncing) return;
    isSyncing = true;

    try {
      const localCollection = get({ subscribe });

      // Merge localStorage into Supabase
      if (Object.keys(localCollection).length > 0) {
        await mergeCollections(userId, localCollection);
      }

      // Load merged collection from Supabase
      const supabaseCollection = await loadFromSupabase(userId);
      set(supabaseCollection);
    } catch (error) {
      console.error('Error during login sync:', error);
    } finally {
      isSyncing = false;
    }
  }

  // Handle user logout - keep localStorage, stop syncing
  function handleLogout() {
    currentUserId = null;
  }

  // Subscribe to user changes
  user.subscribe($user => {
    const newUserId = $user?.id || null;

    if (newUserId && newUserId !== currentUserId) {
      // User just logged in
      currentUserId = newUserId;
      handleLogin(newUserId);
    } else if (!newUserId && currentUserId) {
      // User just logged out
      handleLogout();
    }
  });

  return {
    subscribe,

    increment: (cardId: string): CollectionResult => {
      let result: CollectionResult = { success: true, quantity: 0 };

      update(collection => {
        const current = collection[cardId] || 0;

        if (current >= MAX_QUANTITY) {
          result = { success: false, quantity: current, error: 'MAX_QUANTITY' };
          return collection; // No change
        }

        result.quantity = current + 1;
        return { ...collection, [cardId]: current + 1 };
      });

      // Sync to Supabase asynchronously (non-blocking)
      if (result.success && currentUserId) {
        syncToSupabase(cardId, result.quantity);
      }

      return result;
    },

    decrement: (cardId: string): CollectionResult => {
      let result: CollectionResult = { success: true, quantity: 0 };

      update(collection => {
        const current = collection[cardId] || 0;

        if (current === 0) {
          result = { success: false, quantity: 0, error: 'ALREADY_ZERO' };
          return collection; // No change
        }

        const newQuantity = current - 1;
        result.quantity = newQuantity;

        const updated = { ...collection };
        if (newQuantity === 0) {
          delete updated[cardId]; // Clean up zeros
        } else {
          updated[cardId] = newQuantity;
        }

        return updated;
      });

      // Sync to Supabase asynchronously (non-blocking)
      if (result.success && currentUserId) {
        syncToSupabase(cardId, result.quantity);
      }

      return result;
    },

    getQuantity: (cardId: string): number => {
      return get({ subscribe })[cardId] || 0;
    },

    reset: (): void => {
      set({});
    },

    exportData: (): Collection => {
      return get({ subscribe });
    },

    importCollection: (newCollection: Collection): void => {
      set(newCollection);

      // Sync full collection to Supabase asynchronously (non-blocking)
      if (currentUserId) {
        syncFullCollection(currentUserId, newCollection);
      }
    }
  };
}

export const collection = createCollectionStore();

// Derived store for total cards count
export const totalCards = derived(collection, $collection =>
  Object.values($collection).reduce((sum, qty) => sum + qty, 0)
);
