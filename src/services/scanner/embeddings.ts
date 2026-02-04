import { openDB, type IDBPDatabase } from 'idb';
import type { EmbeddingIndex } from './types';

const DB_NAME = 'simpledex-scanner';
const STORE_NAME = 'embeddings';
const EMBEDDINGS_URL = '/embeddings.bin';

// IndexedDB keys
const INDEX_KEY = 'index';
const ETAG_KEY = 'embeddings-etag';

// Session storage key to track if we've checked for updates this session
const SESSION_CHECK_KEY = 'simpledex-embeddings-checked';

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore(STORE_NAME);
      }
      if (oldVersion < 2) {
        db.createObjectStore('model-meta');
      }
    }
  });
  return dbInstance;
}

export async function isEmbeddingsCached(): Promise<boolean> {
  const db = await getDB();
  const data = await db.get(STORE_NAME, INDEX_KEY);
  return data !== undefined;
}

export async function downloadEmbeddings(onProgress?: (percent: number) => void): Promise<void> {
  const response = await fetch(EMBEDDINGS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch embeddings: ${response.status}`);
  }

  // Capture ETag from response
  const etag = response.headers.get('ETag');

  if (!response.body) {
    throw new Error('Response body is null for embeddings download');
  }

  const reader = response.body.getReader();
  const contentLength = Number(response.headers.get('Content-Length') || 0);

  let received = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (contentLength > 0) {
      onProgress?.(Math.round((received / contentLength) * 100));
    }
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  const index = parseEmbeddingsBinary(buffer);

  const db = await getDB();
  await db.put(STORE_NAME, index, INDEX_KEY);

  // Store ETag if available
  if (etag) {
    await db.put(STORE_NAME, etag, ETAG_KEY);
  }

  // Mark as checked for this session
  markEmbeddingsChecked();
}

export async function getEmbeddings(): Promise<EmbeddingIndex> {
  const db = await getDB();
  const data = await db.get(STORE_NAME, INDEX_KEY);
  if (!data) {
    throw new Error('Embeddings not cached');
  }
  return data as EmbeddingIndex;
}

export async function clearEmbeddingsCache(): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, INDEX_KEY);
  await db.delete(STORE_NAME, ETAG_KEY);
  sessionStorage.removeItem(SESSION_CHECK_KEY);
}

/**
 * Get the stored ETag for embeddings
 */
async function getStoredEmbeddingsETag(): Promise<string | null> {
  try {
    const db = await getDB();
    const etag = await db.get(STORE_NAME, ETAG_KEY);
    return etag ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if the embeddings have been updated on the server
 * Returns 'fresh' if unchanged, 'stale' if updated, 'not-downloaded' if not cached
 */
export async function checkEmbeddingsForUpdates(): Promise<'fresh' | 'stale' | 'not-downloaded'> {
  // Check if we've already verified this session
  if (sessionStorage.getItem(SESSION_CHECK_KEY) === 'checked') {
    return 'fresh';
  }

  const cached = await isEmbeddingsCached();
  if (!cached) {
    return 'not-downloaded';
  }

  const storedETag = await getStoredEmbeddingsETag();
  if (!storedETag) {
    // No ETag stored - assume stale to force re-download with proper ETag tracking
    return 'stale';
  }

  try {
    const response = await fetch(EMBEDDINGS_URL, {
      method: 'HEAD',
      headers: {
        'If-None-Match': storedETag
      }
    });

    if (response.status === 304) {
      // Not modified - mark as checked for this session
      sessionStorage.setItem(SESSION_CHECK_KEY, 'checked');
      return 'fresh';
    }

    // Embeddings have been updated
    return 'stale';
  } catch {
    // Network error - assume fresh to allow offline usage
    sessionStorage.setItem(SESSION_CHECK_KEY, 'checked');
    return 'fresh';
  }
}

/**
 * Mark embeddings as checked for this session (called after successful download)
 */
export function markEmbeddingsChecked(): void {
  sessionStorage.setItem(SESSION_CHECK_KEY, 'checked');
}

function parseEmbeddingsBinary(buffer: Uint8Array): EmbeddingIndex {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;

  // Header: 4 bytes (uint32 card count) + 4 bytes (uint32 embedding dim)
  const cardCount = view.getUint32(offset, true);
  offset += 4;
  const embeddingDim = view.getUint32(offset, true);
  offset += 4;

  const cardIds: string[] = [];
  const totalFloats = cardCount * embeddingDim;
  const embeddings = new Float32Array(totalFloats);

  const decoder = new TextDecoder('utf-8');

  for (let i = 0; i < cardCount; i++) {
    // 1 byte (uint8 cardId length)
    const cardIdLength = view.getUint8(offset);
    offset += 1;

    // N bytes (cardId string, UTF-8)
    const cardIdBytes = buffer.slice(offset, offset + cardIdLength);
    const cardId = decoder.decode(cardIdBytes);
    cardIds.push(cardId);
    offset += cardIdLength;

    // embeddingDim x float32 embedding
    for (let j = 0; j < embeddingDim; j++) {
      embeddings[i * embeddingDim + j] = view.getFloat32(offset, true);
      offset += 4;
    }
  }

  return { cardIds, embeddings };
}
