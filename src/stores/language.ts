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

// Language groups
export const WESTERN_LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt', 'pt-br', 'pt-pt', 'nl', 'pl', 'ru'];
export const ASIAN_LANGUAGES = ['ja', 'ko', 'zh-tw', 'zh-cn', 'id', 'th'];

// All supported languages with full configuration
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  // Western languages
  { code: 'en', label: 'English', flag: '🇬🇧', dataset: 'western' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dataset: 'western' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', dataset: 'western' },
  { code: 'es', label: 'Español', flag: '🇪🇸', dataset: 'western' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', dataset: 'western' },
  { code: 'pt', label: 'Português', flag: '🇵🇹', dataset: 'western' },
  { code: 'pt-br', label: 'Português (Brasil)', flag: '🇧🇷', dataset: 'western' },
  { code: 'pt-pt', label: 'Português (Portugal)', flag: '🇵🇹', dataset: 'western' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱', dataset: 'western' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱', dataset: 'western' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', dataset: 'western' },
  // Asian languages
  { code: 'ja', label: '日本語', flag: '🇯🇵', dataset: 'asian' },
  { code: 'ko', label: '한국어', flag: '🇰🇷', dataset: 'asian' },
  { code: 'zh-tw', label: '中文（繁體）', flag: '🇹🇼', dataset: 'asian' },
  { code: 'zh-cn', label: '中文（简体）', flag: '🇨🇳', dataset: 'asian' },
  { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩', dataset: 'asian' },
  { code: 'th', label: 'ไทย', flag: '🇹🇭', dataset: 'asian' }
];

/**
 * Helper to determine which dataset a language belongs to
 */
export function getDatasetForLanguage(lang: string): Dataset {
  return ASIAN_LANGUAGES.includes(lang) ? 'asian' : 'western';
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
