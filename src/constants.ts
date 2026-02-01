/**
 * Application-wide constants and configuration values
 */

export const STORAGE_KEYS = {
  COLLECTION: 'collection',
  WISHLIST: 'wishlist',
  DECKS: 'decks',
  LANGUAGE: 'selectedLanguage',
  GLC_MODE: 'glcMode',
} as const;

export const DEFAULT_CARD_VARIATION = 'normal';

export const DEFAULT_LANGUAGE = 'en';

export const MAX_CARD_QUANTITY = 99;

export const MODERN_SERIES = [
  'Black & White',
  'XY',
  'Sun & Moon',
  'Sword & Shield',
  'Scarlet & Violet',
  'Mega Evolution'
];
