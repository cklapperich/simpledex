import { writable, get as getStore } from 'svelte/store';
import { STORAGE_KEYS } from '../constants';

function createGLCModeStore() {
  // Load initial state from localStorage
  const initialState = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GLC_MODE);
      return stored === 'true';
    } catch (error) {
      console.warn('Failed to load GLC mode from localStorage, using default', error);
      return false;
    }
  })();

  const { subscribe, set, update } = writable<boolean>(initialState);

  // Auto-save to localStorage on every change
  subscribe(value => {
    try {
      localStorage.setItem(STORAGE_KEYS.GLC_MODE, String(value));
    } catch (error) {
      console.error('Failed to save GLC mode to localStorage', error);
    }
  });

  return {
    subscribe,
    set,
    update,
    toggle: () => update(v => !v),
    get: () => getStore({ subscribe })
  };
}

export const glcMode = createGLCModeStore();
