import type { Collection } from '../types'
import {
  loadCollectionFromSupabase,
  saveCollectionToSupabase,
  deleteCollectionFromSupabase,
  mergeCollectionData,
  syncFullCollectionData,
  type SyncResult
} from './supabaseSync'

export { type SyncResult }

export const loadFromSupabase = loadCollectionFromSupabase

export async function saveToSupabase(
  userId: string,
  cardId: string,
  quantity: number
): Promise<SyncResult> {
  return saveCollectionToSupabase(userId, cardId, quantity)
}

export const deleteFromSupabase = deleteCollectionFromSupabase

export async function mergeCollections(
  userId: string,
  localCollection: Collection
): Promise<SyncResult> {
  return mergeCollectionData(userId, localCollection)
}

export async function syncFullCollection(
  userId: string,
  collection: Collection
): Promise<SyncResult> {
  return syncFullCollectionData(userId, collection)
}
