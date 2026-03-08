import { writable, derived, get } from 'svelte/store';
import type { Card } from '../types';
import { loadSetCodes } from '../utils/setCodes';

function createCardsStore() {
  const allCards = writable<Card[]>([]);
  const isLoading = writable<boolean>(false);
  const error = writable<string | null>(null);
  let hasLoaded = false;

  async function init() {
    if (hasLoaded || get(isLoading)) return;

    isLoading.set(true);
    error.set(null);

    try {
      const [response] = await Promise.all([
        fetch('/cards-western.json'),
        loadSetCodes(),
      ]);
      if (!response.ok) throw new Error('Failed to load cards');
      const cards: Card[] = await response.json();
      allCards.set(cards);
      hasLoaded = true;
    } catch (err) {
      error.set(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error loading cards:', err);
    } finally {
      isLoading.set(false);
    }
  }

  const cardMap = derived(allCards, $cards => {
    const map = new Map<string, Card>();
    for (const card of $cards) {
      if (card?.id) map.set(card.id, card);
    }
    return map;
  });

  const setMap = derived(allCards, $cards => {
    const map = new Map<string, Card[]>();
    for (const card of $cards) {
      if (!card?.set) continue;
      const key = card.set.toLowerCase();
      if (!map.has(key)) map.set(key, []);
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
    init,
  };
}

export const cards = createCardsStore();

export const allCards = { subscribe: cards.subscribe };
export const cardMap = cards.cardMap;
export const setMap = cards.setMap;
export const isLoading = cards.isLoading;
export const cardsError = cards.error;

cards.init();
