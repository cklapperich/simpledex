import { supabase } from '../lib/supabase'
import type { Collection } from '../types'
import { DEFAULT_CARD_VARIATION, DEFAULT_LANGUAGE } from '../constants'
import { selectedLanguage } from '../stores/language'
import { get } from 'svelte/store'

interface SyncResult {
  success: boolean
  error?: string
}

export async function loadFromSupabase(userId: string): Promise<Record<string, number>> {
  const currentLanguage = get(selectedLanguage) || DEFAULT_LANGUAGE;
  console.log('[CollectionSync] loadFromSupabase called. userId:', userId, 'language:', currentLanguage);

  try {
    const { data, error } = await supabase
      .from('collections')
      .select('card_id, quantity')
      .eq('user_id', userId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', currentLanguage)

    if (error) {
      console.error('[CollectionSync] Error loading from Supabase:', error)
      return {}
    }

    console.log('[CollectionSync] Supabase returned', data?.length || 0, 'rows');

    const collection: Record<string, number> = {}
    if (data) {
      for (const row of data) {
        collection[row.card_id] = row.quantity
      }
    }

    console.log('[CollectionSync] Returning collection with', Object.keys(collection).length, 'cards');
    return collection
  } catch (error) {
    console.error('[CollectionSync] Exception loading from Supabase:', error)
    return {}
  }
}

export async function saveToSupabase(
  userId: string,
  cardId: string,
  quantity: number
): Promise<SyncResult> {
  const currentLanguage = get(selectedLanguage) || DEFAULT_LANGUAGE;

  try {
    const { error } = await supabase
      .from('collections')
      .upsert(
        {
          user_id: userId,
          card_id: cardId,
          variation: DEFAULT_CARD_VARIATION,
          language: currentLanguage,
          quantity,
        },
        { onConflict: 'user_id,card_id,variation,language' }
      )

    if (error) {
      console.error('Error saving to Supabase:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Exception saving to Supabase:', error)
    return { success: false, error: message }
  }
}

export async function deleteFromSupabase(userId: string, cardId: string): Promise<SyncResult> {
  const currentLanguage = get(selectedLanguage) || DEFAULT_LANGUAGE;

  try {
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', currentLanguage)

    if (error) {
      console.error('Error deleting from Supabase:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Exception deleting from Supabase:', error)
    return { success: false, error: message }
  }
}

export async function mergeCollections(
  userId: string,
  localCollection: Collection
): Promise<SyncResult> {
  const currentLanguage = get(selectedLanguage) || DEFAULT_LANGUAGE;

  try {
    // Load existing Supabase collection
    const supabaseCollection = await loadFromSupabase(userId)

    // Merge: take max quantity for each card
    const merged: Collection = { ...supabaseCollection }

    for (const [cardId, localQty] of Object.entries(localCollection)) {
      const supabaseQty = supabaseCollection[cardId] || 0
      merged[cardId] = Math.max(localQty, supabaseQty)
    }

    // Batch upsert merged collection
    const upsertData = Object.entries(merged).map(([cardId, quantity]) => ({
      user_id: userId,
      card_id: cardId,
      variation: DEFAULT_CARD_VARIATION,
      language: currentLanguage,
      quantity,
    }))

    if (upsertData.length > 0) {
      const { error } = await supabase
        .from('collections')
        .upsert(upsertData, { onConflict: 'user_id,card_id,variation,language' })

      if (error) {
        console.error('Error merging collections:', error)
        return { success: false, error: error.message }
      }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Exception merging collections:', error)
    return { success: false, error: message }
  }
}

export async function syncFullCollection(
  userId: string,
  collection: Collection
): Promise<SyncResult> {
  const currentLanguage = get(selectedLanguage) || DEFAULT_LANGUAGE;

  try {
    // Delete all existing records for this user
    const { error: deleteError } = await supabase
      .from('collections')
      .delete()
      .eq('user_id', userId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', currentLanguage)

    if (deleteError) {
      console.error('Error deleting existing collection:', deleteError)
      return { success: false, error: deleteError.message }
    }

    // Insert new collection
    const upsertData = Object.entries(collection).map(([cardId, quantity]) => ({
      user_id: userId,
      card_id: cardId,
      variation: DEFAULT_CARD_VARIATION,
      language: currentLanguage,
      quantity,
    }))

    if (upsertData.length > 0) {
      const { error: insertError } = await supabase.from('collections').insert(upsertData)

      if (insertError) {
        console.error('Error inserting new collection:', insertError)
        return { success: false, error: insertError.message }
      }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Exception syncing full collection:', error)
    return { success: false, error: message }
  }
}
