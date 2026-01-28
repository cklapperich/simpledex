import { writable } from 'svelte/store'

export const activeShareCode = writable<string | null>(null)
