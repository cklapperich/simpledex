import { openDB, type IDBPDatabase } from 'idb';
import type { EmbeddingIndex } from './types';

const DB_NAME = 'simpledex-scanner';
const STORE_NAME = 'embeddings';
const EMBEDDINGS_URL = '/embeddings.bin';

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    }
  });
  return dbInstance;
}

export async function isEmbeddingsCached(): Promise<boolean> {
  const db = await getDB();
  const data = await db.get(STORE_NAME, 'index');
  return data !== undefined;
}

export async function downloadEmbeddings(onProgress?: (percent: number) => void): Promise<void> {
  const response = await fetch(EMBEDDINGS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch embeddings: ${response.status}`);
  }

  const reader = response.body!.getReader();
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
  await db.put(STORE_NAME, index, 'index');
}

export async function getEmbeddings(): Promise<EmbeddingIndex> {
  const db = await getDB();
  const data = await db.get(STORE_NAME, 'index');
  if (!data) {
    throw new Error('Embeddings not cached');
  }
  return data as EmbeddingIndex;
}

export async function clearEmbeddingsCache(): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, 'index');
}

function parseEmbeddingsBinary(buffer: Uint8Array): EmbeddingIndex {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;

  // Header: 4 bytes (uint32 card count)
  const cardCount = view.getUint32(offset, true);
  offset += 4;

  const cardIds: string[] = [];
  const embeddingDim = 512;
  const totalFloats = cardCount * embeddingDim;
  const embeddings = new Float32Array(totalFloats);

  const decoder = new TextDecoder('utf-8');

  for (let i = 0; i < cardCount; i++) {
    // 4 bytes (uint32 cardId length)
    const cardIdLength = view.getUint32(offset, true);
    offset += 4;

    // N bytes (cardId string, UTF-8)
    const cardIdBytes = buffer.slice(offset, offset + cardIdLength);
    const cardId = decoder.decode(cardIdBytes);
    cardIds.push(cardId);
    offset += cardIdLength;

    // 2048 bytes (512 x float32 embedding)
    for (let j = 0; j < embeddingDim; j++) {
      embeddings[i * embeddingDim + j] = view.getFloat32(offset, true);
      offset += 4;
    }
  }

  return { cardIds, embeddings };
}
