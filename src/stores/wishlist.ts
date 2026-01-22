import { writable, derived, get } from 'svelte/store';
import type { Wishlist, WishlistResult } from '../types';
import { user } from './auth';
import { loadFromSupabase, saveToSupabase, deleteFromSupabase, mergeWishlists, syncFullWishlist } from '../utils/wishlistSync';
import { STORAGE_KEYS } from '../constants';
import { selectedLanguage } from './language';

// Module-level state for tracking current user and sync status
let currentUserId: string | null = null;
let isSyncing = false;

// Store for sync errors that can be displayed in UI
export const wishlistSyncError = writable<string | null>(null);

function createWishlistStore() {
  // Load initial data from localStorage
  const initialData = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WISHLIST);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to load wishlist from localStorage, using empty wishlist', error);
      return {};
    }
  })();

  const { subscribe, set, update } = writable<Wishlist>(initialData);

  // Auto-save to localStorage on every change
  subscribe(value => {
    try {
      localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save wishlist to localStorage', error);
    }
  });

  // Helper function to sync a single card to Supabase
  async function syncToSupabase(cardId: string, isOnWishlist: boolean) {
    if (!currentUserId || isSyncing) return;

    try {
      wishlistSyncError.set(null); // Clear any previous errors
      const result = isOnWishlist
        ? await saveToSupabase(currentUserId, cardId)
        : await deleteFromSupabase(currentUserId, cardId);

      if (!result.success) {
        wishlistSyncError.set(result.error || 'Wishlist sync failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('Error syncing wishlist to Supabase:', error);
      wishlistSyncError.set(message);
    }
  }

  // Handle user login - merge localStorage with Supabase
  async function handleLogin(userId: string) {
    if (isSyncing) return;
    isSyncing = true;

    try {
      wishlistSyncError.set(null); // Clear any previous errors
      const localWishlist = get({ subscribe });

      // Merge localStorage into Supabase (union)
      if (Object.keys(localWishlist).length > 0) {
        const mergeResult = await mergeWishlists(userId, localWishlist);
        if (!mergeResult.success) {
          wishlistSyncError.set(mergeResult.error || 'Failed to merge wishlists');
        }
      }

      // Load merged wishlist from Supabase
      const supabaseWishlist = await loadFromSupabase(userId);
      set(supabaseWishlist);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown login sync error';
      console.error('Error during wishlist login sync:', error);
      wishlistSyncError.set(message);
    } finally {
      isSyncing = false;
    }
  }

  // Handle user logout - keep localStorage, stop syncing
  function handleLogout() {
    currentUserId = null;
    wishlistSyncError.set(null); // Clear sync errors on logout
  }

  // Subscribe to user changes
  const unsubscribeUser = user.subscribe(async ($user) => {
    const newUserId = $user?.id || null;

    if (newUserId && newUserId !== currentUserId) {
      // User just logged in
      currentUserId = newUserId;
      await handleLogin(newUserId);
    } else if (!newUserId && currentUserId) {
      // User just logged out
      handleLogout();
    }
  });

  // Subscribe to language changes - reload wishlist when language changes
  const unsubscribeLanguage = selectedLanguage.subscribe(async (newLanguage) => {
    if (currentUserId && !isSyncing) {
      // Language changed while logged in - reload wishlist for new language
      isSyncing = true;
      try {
        const supabaseWishlist = await loadFromSupabase(currentUserId);
        set(supabaseWishlist);
      } catch (error) {
        console.error('Error reloading wishlist for new language:', error);
      } finally {
        isSyncing = false;
      }
    }
  });

  return {
    subscribe,

    add: (cardId: string): WishlistResult => {
      let result: WishlistResult = { success: true, isOnWishlist: false };

      update(wishlist => {
        const wasOnWishlist = wishlist[cardId] === true;

        if (wasOnWishlist) {
          // Already on wishlist
          result = { success: true, isOnWishlist: true };
          return wishlist;
        }

        // Add to wishlist
        result = { success: true, isOnWishlist: true, addedNew: true };
        return { ...wishlist, [cardId]: true };
      });

      // Sync to Supabase asynchronously (non-blocking)
      if (result.addedNew && currentUserId) {
        syncToSupabase(cardId, true);
      }

      return result;
    },

    remove: (cardId: string): WishlistResult => {
      let result: WishlistResult = { success: true, isOnWishlist: false };

      update(wishlist => {
        const wasOnWishlist = wishlist[cardId] === true;

        if (!wasOnWishlist) {
          // Already not on wishlist
          result = { success: true, isOnWishlist: false };
          return wishlist;
        }

        // Remove from wishlist
        const updated = { ...wishlist };
        delete updated[cardId];
        result = { success: true, isOnWishlist: false, removed: true };
        return updated;
      });

      // Sync to Supabase asynchronously (non-blocking)
      if (result.removed && currentUserId) {
        syncToSupabase(cardId, false);
      }

      return result;
    },

    toggle: (cardId: string): WishlistResult => {
      const current = get({ subscribe });
      const isCurrentlyOnWishlist = current[cardId] === true;

      if (isCurrentlyOnWishlist) {
        return wishlistStore.remove(cardId);
      } else {
        return wishlistStore.add(cardId);
      }
    },

    has: (cardId: string): boolean => {
      return get({ subscribe })[cardId] === true;
    },

    reset: (): void => {
      set({});
    },

    exportData: (): Wishlist => {
      return get({ subscribe });
    },

    importWishlist: (newWishlist: Wishlist): void => {
      set(newWishlist);

      // Sync full wishlist to Supabase asynchronously (non-blocking)
      if (currentUserId) {
        syncFullWishlist(currentUserId, newWishlist);
      }
    }
  };
}

export const wishlist = createWishlistStore();
const wishlistStore = wishlist; // For use in toggle method

// Derived store for total wishlisted cards count
export const totalWishlisted = derived(wishlist, $wishlist =>
  Object.keys($wishlist).length
);
