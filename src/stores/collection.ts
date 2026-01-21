import { writable, derived, get } from 'svelte/store';
import type { Collection, CollectionResult } from '../types';

const STORAGE_KEY = 'collection';
const MAX_QUANTITY = 99;

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
    }
  };
}

export const collection = createCollectionStore();

// Derived store for total cards count
export const totalCards = derived(collection, $collection =>
  Object.values($collection).reduce((sum, qty) => sum + qty, 0)
);
