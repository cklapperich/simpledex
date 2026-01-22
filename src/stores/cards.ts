import { writable, derived, get } from 'svelte/store';
import type { Card } from '../types';
import { selectedLanguage, getDatasetForLanguage, type Dataset } from './language';

function createCardsStore() {
  const allCards = writable<Card[]>([]);
  const isLoading = writable<boolean>(false);
  const error = writable<string | null>(null);

  // Dataset cache - stores both western and asian datasets
  const datasetCache: Map<Dataset, Card[]> = new Map();

  let currentDataset: Dataset = 'western';
  let hasInitialLoad = false;

  /**
   * Load a dataset from JSON file (with caching)
   */
  async function loadDataset(dataset: Dataset): Promise<Card[]> {
    // Return from cache if available
    if (datasetCache.has(dataset)) {
      console.log(`Using cached ${dataset} dataset`);
      return datasetCache.get(dataset)!;
    }

    console.log(`Loading ${dataset} dataset...`);
    isLoading.set(true);
    error.set(null);

    try {
      const response = await fetch(`/cards-${dataset}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load ${dataset} cards`);
      }

      const cards: Card[] = await response.json();
      console.log(`Loaded ${cards.length} cards from ${dataset} dataset`);

      // Cache the dataset
      datasetCache.set(dataset, cards);
      return cards;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      error.set(message);
      console.error(`Error loading ${dataset} dataset:`, err);
      throw err;
    } finally {
      isLoading.set(false);
    }
  }

  /**
   * Switch to a language (may require dataset switch)
   */
  async function switchToLanguage(language: string) {
    const requiredDataset = getDatasetForLanguage(language);

    // Check if we need to switch datasets
    if (requiredDataset !== currentDataset || !hasInitialLoad) {
      console.log(`Switching from ${currentDataset} to ${requiredDataset} dataset for language ${language}`);
      currentDataset = requiredDataset;

      try {
        const cards = await loadDataset(requiredDataset);
        allCards.set(cards);
        hasInitialLoad = true;
      } catch (err) {
        console.error('Failed to switch dataset:', err);
        // Keep existing cards on error
      }
    } else {
      console.log(`Language ${language} uses same dataset (${currentDataset}), no switch needed`);
    }
  }

  /**
   * Initialize with western dataset on first use
   */
  async function init() {
    if (!hasInitialLoad) {
      console.log('Initializing cards store with western dataset');
      try {
        const cards = await loadDataset('western');
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
    switchToLanguage,
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

/**
 * Filtered cards - only cards that have a name in the selected language
 * This ensures cards without the selected language are not shown
 */
export const filteredCards = derived(
  [allCards, selectedLanguage],
  ([$allCards, $language]) => {
    return $allCards.filter(card => card.names[$language] !== undefined);
  }
);

/**
 * Filtered card map - cardMap but only for cards available in selected language
 */
export const filteredCardMap = derived(filteredCards, $cards => {
  const map = new Map<string, Card>();
  for (const card of $cards) {
    if (!card || !card.id) continue;
    map.set(card.id, card);
  }
  return map;
});

/**
 * Filtered set map - setMap but only for cards available in selected language
 */
export const filteredSetMap = derived(filteredCards, $cards => {
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

// Subscribe to language changes and switch datasets accordingly
selectedLanguage.subscribe(async (newLanguage) => {
  await cards.switchToLanguage(newLanguage);
});

// Initialize the store (load western dataset by default)
cards.init();
