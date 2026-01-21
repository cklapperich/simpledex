import { writable, derived, get } from 'svelte/store';
import type { Card } from '../types';

function createCardsStore() {
  const allCards = writable<Card[]>([]);
  const isLoading = writable<boolean>(false);
  const error = writable<string | null>(null);
  let hasLoaded = false;

  async function load() {
    if (hasLoaded || get(isLoading)) return;

    isLoading.set(true);
    error.set(null);

    try {
      const response = await fetch('/cards.json');
      if (!response.ok) {
        throw new Error('Failed to load cards');
      }
      const cards = await response.json();
      allCards.set(cards);
      hasLoaded = true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.set(errorMessage);
      console.error('Error loading cards:', err);
    } finally {
      isLoading.set(false);
    }
  }

  // Auto-load on first subscription
  const { subscribe } = derived(allCards, ($cards, set) => {
    if (!hasLoaded && !get(isLoading)) {
      load();
    }
    set($cards);
  });

  // Derived store for cardMap - O(1) lookups by card ID
  const cardMap = derived(allCards, $cards =>
    new Map($cards.map(card => [card.id, card]))
  );

  // Derived store for setMap - instant set name lookups
  const setMap = derived(allCards, $cards => {
    const map = new Map<string, Card[]>();
    for (const card of $cards) {
      const key = card.set.toLowerCase();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(card);
    }
    return map;
  });

  return {
    subscribe,
    cardMap: { subscribe: cardMap.subscribe },
    setMap: { subscribe: setMap.subscribe },
    isLoading: { subscribe: isLoading.subscribe },
    error: { subscribe: error.subscribe },
    reload: load
  };
}

export const cards = createCardsStore();
export const allCards = { subscribe: cards.subscribe };  // Export array store with clear name
export const cardMap = cards.cardMap;
export const setMap = cards.setMap;
export const isLoading = cards.isLoading;
export const cardsError = cards.error;
