import { supabase } from '../lib/supabase'
import type { Wishlist } from '../types'
import { DEFAULT_CARD_VARIATION, DEFAULT_LANGUAGE } from '../constants'
import { selectedLanguage } from '../stores/language'
import { get } from 'svelte/store'

interface SyncResult {
  success: boolean
  error?: string
}

export async function loadFromSupabase(userId: string): Promise<Record<string, boolean>> {
  const currentLanguage = get(selectedLanguage) || DEFAULT_LANGUAGE;

  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select('card_id')
      .eq('user_id', userId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', currentLanguage)

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
  const currentLanguage = get(selectedLanguage) || DEFAULT_LANGUAGE;

  try {
    const { error } = await supabase
      .from('wishlists')
      .upsert(
        {
          user_id: userId,
          card_id: cardId,
          variation: DEFAULT_CARD_VARIATION,
          language: currentLanguage,
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
  const currentLanguage = get(selectedLanguage) || DEFAULT_LANGUAGE;

  try {
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', currentLanguage)

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
  const currentLanguage = get(selectedLanguage) || DEFAULT_LANGUAGE;

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
      language: currentLanguage,
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
  const currentLanguage = get(selectedLanguage) || DEFAULT_LANGUAGE;

  try {
    // Delete all existing records for this user
    const { error: deleteError } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', userId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', currentLanguage)

    if (deleteError) {
      console.error('Error deleting existing wishlist:', deleteError)
      return { success: false, error: deleteError.message }
    }

    // Insert new wishlist
    const upsertData = Object.keys(wishlist).map((cardId) => ({
      user_id: userId,
      card_id: cardId,
      variation: DEFAULT_CARD_VARIATION,
      language: currentLanguage,
    }))

    if (upsertData.length > 0) {
      const { error: insertError } = await supabase.from('wishlists').insert(upsertData)

      if (insertError) {
        console.error('Error inserting new wishlist:', insertError)
        return { success: false, error: insertError.message }
      }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Exception syncing full wishlist:', error)
    return { success: false, error: message }
  }
}
