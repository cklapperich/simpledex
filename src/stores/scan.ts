import { writable, get } from 'svelte/store';
import type { Card } from '../types';
import { scannerService } from '../services/scanner';

export interface QueueItem {
  id: string;
  imageBlob: Blob;
  thumbnailUrl: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  result?: ScanResult;
  error?: string;
}

export interface ScanResult {
  matches: Array<{
    cardId: string;
    score: number;
    card: Card;
  }>;
}

interface ScanState {
  setupComplete: boolean;
  downloadProgress: number | null;
  downloadError: string | null;
  cameraPermission: 'pending' | 'granted' | 'denied';
  cameraActive: boolean;
  queueItems: QueueItem[];
}

function createScanStore() {
  const initialState: ScanState = {
    setupComplete: false,
    downloadProgress: null,
    downloadError: null,
    cameraPermission: 'pending',
    cameraActive: false,
    queueItems: []
  };

  const { subscribe, set, update } = writable<ScanState>(initialState);

  return {
    subscribe,

    checkSetupStatus: async () => {
      const isReady = await scannerService.isReady();
      update(state => ({ ...state, setupComplete: isReady }));
      return isReady;
    },

    startDownload: async () => {
      update(state => ({ ...state, downloadProgress: 0, downloadError: null }));

      try {
        await scannerService.download((progress) => {
          update(state => ({ ...state, downloadProgress: progress }));
        });
        update(state => ({ ...state, setupComplete: true, downloadProgress: null }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Download failed';
        update(state => ({ ...state, downloadError: message, downloadProgress: null }));
      }
    },

    setDownloadProgress: (progress: number) => {
      update(state => ({ ...state, downloadProgress: progress }));
    },

    setCameraPermission: (permission: 'pending' | 'granted' | 'denied') => {
      update(state => ({ ...state, cameraPermission: permission }));
    },

    setCameraActive: (active: boolean) => {
      update(state => ({ ...state, cameraActive: active }));
    },

    addToQueue: (blob: Blob): string => {
      const id = crypto.randomUUID();
      const thumbnailUrl = URL.createObjectURL(blob);

      const item: QueueItem = {
        id,
        imageBlob: blob,
        thumbnailUrl,
        status: 'pending'
      };

      update(state => ({
        ...state,
        queueItems: [...state.queueItems, item]
      }));

      return id;
    },

    setItemStatus: (id: string, status: QueueItem['status'], error?: string) => {
      update(state => ({
        ...state,
        queueItems: state.queueItems.map(item =>
          item.id === id ? { ...item, status, error } : item
        )
      }));
    },

    setResult: (id: string, result: ScanResult) => {
      update(state => ({
        ...state,
        queueItems: state.queueItems.map(item =>
          item.id === id ? { ...item, status: 'complete' as const, result, error: undefined } : item
        )
      }));
    },

    removeFromQueue: (id: string) => {
      const state = get({ subscribe });
      const item = state.queueItems.find(i => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.thumbnailUrl);
      }

      update(state => ({
        ...state,
        queueItems: state.queueItems.filter(item => item.id !== id)
      }));
    },

    getItem: (id: string): QueueItem | undefined => {
      const state = get({ subscribe });
      return state.queueItems.find(item => item.id === id);
    },

    reset: () => {
      const state = get({ subscribe });
      state.queueItems.forEach(item => URL.revokeObjectURL(item.thumbnailUrl));
      set(initialState);
    }
  };
}

export const scanStore = createScanStore();
