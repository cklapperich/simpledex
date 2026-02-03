import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabaseTypes'
import { DEFAULT_CARD_VARIATION, DEFAULT_LANGUAGE } from '../constants'

export interface SyncResult {
  success: boolean
  error?: string
}

type CollectionInsert = Database['public']['Tables']['collections']['Insert']
type WishlistInsert = Database['public']['Tables']['wishlists']['Insert']

// ============= Collection Sync =============

export async function loadCollectionFromSupabase(userId: string): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('card_id, quantity')
      .eq('user_id', userId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', DEFAULT_LANGUAGE)

    if (error) {
      console.error('[CollectionSync] Error loading from Supabase:', error)
      return {}
    }

    const result: Record<string, number> = {}
    if (data) {
      for (const row of data) {
        result[row.card_id] = row.quantity
      }
    }
    return result
  } catch (error) {
    console.error('[CollectionSync] Exception loading from Supabase:', error)
    return {}
  }
}

export async function saveCollectionToSupabase(
  userId: string,
  cardId: string,
  quantity: number
): Promise<SyncResult> {
  try {
    const row: CollectionInsert = {
      user_id: userId,
      card_id: cardId,
      variation: DEFAULT_CARD_VARIATION,
      language: DEFAULT_LANGUAGE,
      quantity
    }

    const { error } = await supabase
      .from('collections')
      .upsert(row, { onConflict: 'user_id,card_id,variation,language' })

    if (error) {
      console.error('[CollectionSync] Error saving to Supabase:', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CollectionSync] Exception saving to Supabase:', error)
    return { success: false, error: message }
  }
}

export async function deleteCollectionFromSupabase(userId: string, cardId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', DEFAULT_LANGUAGE)

    if (error) {
      console.error('[CollectionSync] Error deleting from Supabase:', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CollectionSync] Exception deleting from Supabase:', error)
    return { success: false, error: message }
  }
}

export async function mergeCollectionData(
  userId: string,
  localData: Record<string, number>
): Promise<SyncResult> {
  try {
    const remoteData = await loadCollectionFromSupabase(userId)

    // Merge: take max quantity for each card
    const merged: Record<string, number> = { ...remoteData }
    for (const [cardId, localQty] of Object.entries(localData)) {
      const remoteQty = remoteData[cardId] || 0
      merged[cardId] = Math.max(localQty, remoteQty)
    }

    // Batch upsert
    const upsertData: CollectionInsert[] = Object.entries(merged)
      .filter(([, qty]) => qty > 0)
      .map(([cardId, quantity]) => ({
        user_id: userId,
        card_id: cardId,
        variation: DEFAULT_CARD_VARIATION,
        language: DEFAULT_LANGUAGE,
        quantity
      }))

    if (upsertData.length > 0) {
      const { error } = await supabase
        .from('collections')
        .upsert(upsertData, { onConflict: 'user_id,card_id,variation,language' })

      if (error) {
        console.error('[CollectionSync] Error merging:', error)
        return { success: false, error: error.message }
      }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CollectionSync] Exception merging:', error)
    return { success: false, error: message }
  }
}

export async function syncFullCollectionData(
  userId: string,
  data: Record<string, number>
): Promise<SyncResult> {
  try {
    const existingData = await loadCollectionFromSupabase(userId)

    // Upsert all current data
    const upsertData: CollectionInsert[] = Object.entries(data)
      .filter(([, qty]) => qty > 0)
      .map(([cardId, quantity]) => ({
        user_id: userId,
        card_id: cardId,
        variation: DEFAULT_CARD_VARIATION,
        language: DEFAULT_LANGUAGE,
        quantity
      }))

    if (upsertData.length > 0) {
      const { error } = await supabase
        .from('collections')
        .upsert(upsertData, { onConflict: 'user_id,card_id,variation,language' })

      if (error) {
        console.error('[CollectionSync] Error upserting:', error)
        return { success: false, error: error.message }
      }
    }

    // Delete cards that exist remotely but not locally
    const cardsToDelete = Object.keys(existingData).filter(cardId => !(cardId in data))
    if (cardsToDelete.length > 0) {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('user_id', userId)
        .eq('variation', DEFAULT_CARD_VARIATION)
        .eq('language', DEFAULT_LANGUAGE)
        .in('card_id', cardsToDelete)

      if (error) {
        console.error('[CollectionSync] Error deleting removed cards:', error)
        return { success: false, error: error.message }
      }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CollectionSync] Exception syncing:', error)
    return { success: false, error: message }
  }
}

// ============= Wishlist Sync =============

export async function loadWishlistFromSupabase(userId: string): Promise<Record<string, boolean>> {
  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select('card_id')
      .eq('user_id', userId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', DEFAULT_LANGUAGE)

    if (error) {
      console.error('[WishlistSync] Error loading from Supabase:', error)
      return {}
    }

    const result: Record<string, boolean> = {}
    if (data) {
      for (const row of data) {
        result[row.card_id] = true
      }
    }
    return result
  } catch (error) {
    console.error('[WishlistSync] Exception loading from Supabase:', error)
    return {}
  }
}

export async function saveWishlistToSupabase(
  userId: string,
  cardId: string
): Promise<SyncResult> {
  try {
    const row: WishlistInsert = {
      user_id: userId,
      card_id: cardId,
      variation: DEFAULT_CARD_VARIATION,
      language: DEFAULT_LANGUAGE
    }

    const { error } = await supabase
      .from('wishlists')
      .upsert(row, { onConflict: 'user_id,card_id,variation,language' })

    if (error) {
      console.error('[WishlistSync] Error saving to Supabase:', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[WishlistSync] Exception saving to Supabase:', error)
    return { success: false, error: message }
  }
}

export async function deleteWishlistFromSupabase(userId: string, cardId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', DEFAULT_LANGUAGE)

    if (error) {
      console.error('[WishlistSync] Error deleting from Supabase:', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[WishlistSync] Exception deleting from Supabase:', error)
    return { success: false, error: message }
  }
}

export async function mergeWishlistData(
  userId: string,
  localData: Record<string, boolean>
): Promise<SyncResult> {
  try {
    const remoteData = await loadWishlistFromSupabase(userId)

    // Merge: union of both
    const merged: Record<string, boolean> = { ...remoteData, ...localData }

    // Batch upsert
    const upsertData: WishlistInsert[] = Object.keys(merged)
      .filter(cardId => merged[cardId])
      .map(cardId => ({
        user_id: userId,
        card_id: cardId,
        variation: DEFAULT_CARD_VARIATION,
        language: DEFAULT_LANGUAGE
      }))

    if (upsertData.length > 0) {
      const { error } = await supabase
        .from('wishlists')
        .upsert(upsertData, { onConflict: 'user_id,card_id,variation,language' })

      if (error) {
        console.error('[WishlistSync] Error merging:', error)
        return { success: false, error: error.message }
      }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[WishlistSync] Exception merging:', error)
    return { success: false, error: message }
  }
}

export async function syncFullWishlistData(
  userId: string,
  data: Record<string, boolean>
): Promise<SyncResult> {
  try {
    const existingData = await loadWishlistFromSupabase(userId)

    // Upsert all current data
    const upsertData: WishlistInsert[] = Object.keys(data)
      .filter(cardId => data[cardId])
      .map(cardId => ({
        user_id: userId,
        card_id: cardId,
        variation: DEFAULT_CARD_VARIATION,
        language: DEFAULT_LANGUAGE
      }))

    if (upsertData.length > 0) {
      const { error } = await supabase
        .from('wishlists')
        .upsert(upsertData, { onConflict: 'user_id,card_id,variation,language' })

      if (error) {
        console.error('[WishlistSync] Error upserting:', error)
        return { success: false, error: error.message }
      }
    }

    // Delete cards that exist remotely but not locally
    const cardsToDelete = Object.keys(existingData).filter(cardId => !(cardId in data))
    if (cardsToDelete.length > 0) {
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', userId)
        .eq('variation', DEFAULT_CARD_VARIATION)
        .eq('language', DEFAULT_LANGUAGE)
        .in('card_id', cardsToDelete)

      if (error) {
        console.error('[WishlistSync] Error deleting removed cards:', error)
        return { success: false, error: error.message }
      }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[WishlistSync] Exception syncing:', error)
    return { success: false, error: message }
  }
}
