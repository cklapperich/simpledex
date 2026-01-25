import { supabase } from '../lib/supabase'
import type { Wishlist } from '../types'
import { DEFAULT_CARD_VARIATION, DEFAULT_LANGUAGE } from '../constants'

interface SyncResult {
  success: boolean
  error?: string
}

export async function loadFromSupabase(userId: string): Promise<Record<string, boolean>> {
  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select('card_id')
      .eq('user_id', userId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', DEFAULT_LANGUAGE)

    if (error) {
      console.error('Error loading wishlist from Supabase:', error)
      return {}
    }

    const wishlist: Record<string, boolean> = {}
    if (data) {
      for (const row of data) {
        wishlist[row.card_id] = true
      }
    }

    return wishlist
  } catch (error) {
    console.error('Exception loading wishlist from Supabase:', error)
    return {}
  }
}

export async function saveToSupabase(
  userId: string,
  cardId: string
): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('wishlists')
      .upsert(
        {
          user_id: userId,
          card_id: cardId,
          variation: DEFAULT_CARD_VARIATION,
          language: DEFAULT_LANGUAGE,
        },
        { onConflict: 'user_id,card_id,variation,language' }
      )

    if (error) {
      console.error('Error saving to Supabase wishlist:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Exception saving to Supabase wishlist:', error)
    return { success: false, error: message }
  }
}

export async function deleteFromSupabase(userId: string, cardId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', DEFAULT_LANGUAGE)

    if (error) {
      console.error('Error deleting from Supabase wishlist:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Exception deleting from Supabase wishlist:', error)
    return { success: false, error: message }
  }
}

export async function mergeWishlists(
  userId: string,
  localWishlist: Wishlist
): Promise<SyncResult> {
  try {
    // Load existing Supabase wishlist
    const supabaseWishlist = await loadFromSupabase(userId)

    // Merge: union both wishlists (combine all cards from both)
    const merged: Wishlist = { ...supabaseWishlist, ...localWishlist }

    // Batch upsert merged wishlist
    const upsertData = Object.keys(merged).map((cardId) => ({
      user_id: userId,
      card_id: cardId,
      variation: DEFAULT_CARD_VARIATION,
      language: DEFAULT_LANGUAGE,
    }))

    if (upsertData.length > 0) {
      const { error } = await supabase
        .from('wishlists')
        .upsert(upsertData, { onConflict: 'user_id,card_id,variation,language' })

      if (error) {
        console.error('Error merging wishlists:', error)
        return { success: false, error: error.message }
      }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Exception merging wishlists:', error)
    return { success: false, error: message }
  }
}

export async function syncFullWishlist(
  userId: string,
  wishlist: Wishlist
): Promise<SyncResult> {
  try {
    // Load existing wishlist to calculate diff
    const existingWishlist = await loadFromSupabase(userId)

    // Upsert all cards in new wishlist (insert or update)
    const upsertData = Object.keys(wishlist).map((cardId) => ({
      user_id: userId,
      card_id: cardId,
      variation: DEFAULT_CARD_VARIATION,
      language: DEFAULT_LANGUAGE,
    }))

    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from('wishlists')
        .upsert(upsertData, { onConflict: 'user_id,card_id,variation,language' })

      if (upsertError) {
        console.error('Error upserting wishlist:', upsertError)
        return { success: false, error: upsertError.message }
      }
    }

    // Delete cards that exist in Supabase but not in new wishlist
    const cardsToDelete = Object.keys(existingWishlist).filter(cardId => !(cardId in wishlist))

    if (cardsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', userId)
        .eq('variation', DEFAULT_CARD_VARIATION)
        .eq('language', DEFAULT_LANGUAGE)
        .in('card_id', cardsToDelete)

      if (deleteError) {
        console.error('Error deleting removed cards:', deleteError)
        return { success: false, error: deleteError.message }
      }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Exception syncing full wishlist:', error)
    return { success: false, error: message }
  }
}
