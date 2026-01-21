import { writable } from 'svelte/store';

export type View = 'collection' | 'search';

export const activeView = writable<View>('search');
