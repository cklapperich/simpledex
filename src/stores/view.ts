import { writable } from 'svelte/store';

export type View = 'collection' | 'search' | 'about' | 'decks' | 'deckbuilder';

export const activeView = writable<View>('search');
export const activeDeckId = writable<string | null>(null);
