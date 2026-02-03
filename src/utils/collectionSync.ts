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

// Re-export with original names for backwards compatibility
export { loadCollectionFromSupabase as loadFromSupabase }
export { saveCollectionToSupabase as saveToSupabase }
export { deleteCollectionFromSupabase as deleteFromSupabase }
export { mergeCollectionData as mergeCollections }
export { syncFullCollectionData as syncFullCollection }
