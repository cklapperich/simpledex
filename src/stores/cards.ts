import { writable, derived } from 'svelte/store';
import type { Card } from '../types';
import { loadSetCodes } from '../utils/setCodes';

function createCardsStore() {
  const allCards = writable<Card[]>([]);
  const isLoading = writable<boolean>(false);
  const error = writable<string | null>(null);

  let hasInitialLoad = false;

  /**
   * Load cards from JSON file
   */
  async function loadCards(): Promise<Card[]> {
    console.log('Loading cards...');
    isLoading.set(true);
    error.set(null);

    try {
      const response = await fetch('/cards-western.json');
      if (!response.ok) {
        throw new Error('Failed to load cards');
      }

      const cards: Card[] = await response.json();
      console.log(`Loaded ${cards.length} cards`);

      return cards;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      error.set(message);
      console.error('Error loading cards:', err);
      throw err;
    } finally {
      isLoading.set(false);
    }
  }

  /**
   * Initialize cards on first use
   */
  async function init() {
    if (!hasInitialLoad) {
      console.log('Initializing cards store');
      try {
        // Load cards and set codes in parallel
        const [cards] = await Promise.all([
          loadCards(),
          loadSetCodes()
        ]);
        allCards.set(cards);
        hasInitialLoad = true;
      } catch (err) {
        console.error('Failed to initialize cards store:', err);
      }
    }
  }

  // Derived store for cardMap - O(1) lookups by card ID
  const cardMap = derived(allCards, $cards => {
    const map = new Map<string, Card>();
    for (const card of $cards) {
      if (!card || !card.id) continue;
      map.set(card.id, card);
    }
    return map;
  });

  // Derived store for setMap - instant set name lookups
  const setMap = derived(allCards, $cards => {
    const map = new Map<string, Card[]>();
    for (const card of $cards) {
      if (!card || !card.set) continue;

      const key = card.set.toLowerCase();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(card);
    }
    return map;
  });

  return {
    subscribe: allCards.subscribe,
    cardMap: { subscribe: cardMap.subscribe },
    setMap: { subscribe: setMap.subscribe },
    isLoading: { subscribe: isLoading.subscribe },
    error: { subscribe: error.subscribe },
    init
  };
}

export const cards = createCardsStore();

// Export individual stores with clear names
export const allCards = { subscribe: cards.subscribe };
export const cardMap = cards.cardMap;
export const setMap = cards.setMap;
export const isLoading = cards.isLoading;
export const cardsError = cards.error;

// Initialize the store
cards.init();
