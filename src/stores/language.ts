import { writable, get as getStore } from 'svelte/store';
import { STORAGE_KEYS, DEFAULT_LANGUAGE } from '../constants';

// Dataset types
export type Dataset = 'western' | 'asian';

// Language configuration with dataset mapping
export interface LanguageInfo {
  code: string;
  label: string;
  flag: string;
  dataset: Dataset;
}

// Only include languages with actual card images available on TCGdex CDN
// EN and FR: Complete image coverage for all sets
// DE and IT: Images available for modern sets (XY onwards)
export const WESTERN_LANGUAGES = ['en', 'fr', 'de', 'it'];

// All supported languages with full configuration
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', label: 'English', flag: '🇬🇧', dataset: 'western' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dataset: 'western' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', dataset: 'western' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', dataset: 'western' }
];

/**
 * Helper to determine which dataset a language belongs to
 * Currently only 'western' since we removed asian language support
 */
export function getDatasetForLanguage(lang: string): Dataset {
  return 'western';
}

function createLanguageStore() {
  // Load initial language from localStorage
  const initialLanguage = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
      return stored || DEFAULT_LANGUAGE;
    } catch (error) {
      console.warn('Failed to load language from localStorage, using default', error);
      return DEFAULT_LANGUAGE;
    }
  })();

  const { subscribe, set, update } = writable<string>(initialLanguage);

  // Auto-save to localStorage on every change
  subscribe(value => {
    try {
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, value);
    } catch (error) {
      console.error('Failed to save language to localStorage', error);
    }
  });

  return {
    subscribe,
    set,
    update,
    // Provide synchronous get method for use in sync functions
    get: () => getStore({ subscribe })
  };
}

export const selectedLanguage = createLanguageStore();
