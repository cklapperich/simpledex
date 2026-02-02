import { writable } from 'svelte/store';

export type View = 'search' | 'about' | 'decks' | 'deckbuilder' | 'shared';

export const activeView = writable<View>('search');
export const activeDeckId = writable<string | null>(null);
