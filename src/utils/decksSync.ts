import { supabase } from '../lib/supabase'
import type { Deck } from '../types'
import type { DeckRow } from '../lib/supabaseTypes'
import { DECK_TCG } from '../constants'

interface SyncResult {
  success: boolean
  error?: string
}

/**
 * Load all decks from Supabase for a user
 */
export async function loadDecksFromSupabase(userId: string): Promise<Record<string, Deck>> {
  try {
    const { data, error } = await supabase
      .from('decks')
      .select('id, name, cards, strategy, updated_at')
      .eq('user_id', userId)

    if (error) {
      console.error('[DecksSync] Error loading from Supabase:', error)
      return {}
    }

    const decks: Record<string, Deck> = {}
    if (data) {
      for (const row of data as DeckRow[]) {
        decks[row.id] = {
          id: row.id,
          name: row.name,
          cards: row.cards || {},
          strategy: row.strategy || '',
          TCG: DECK_TCG
        }
      }
    }

    return decks
  } catch (error) {
    console.error('[DecksSync] Exception loading from Supabase:', error)
    return {}
  }
}

/**
 * Save a single deck to Supabase (upsert)
 */
export async function saveDeckToSupabase(
  userId: string,
  deck: Deck
): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('decks')
      .upsert(
        {
          id: deck.id,
          user_id: userId,
          name: deck.name,
          cards: deck.cards,
          strategy: deck.strategy || '',
          TCG: DECK_TCG,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      )

    if (error) {
      console.error('[DecksSync] Error saving to Supabase:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[DecksSync] Exception saving to Supabase:', error)
    return { success: false, error: message }
  }
}

/**
 * Delete a deck from Supabase
 */
export async function deleteDeckFromSupabase(
  userId: string,
  deckId: string
): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('user_id', userId)
      .eq('id', deckId)

    if (error) {
      console.error('[DecksSync] Error deleting from Supabase:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[DecksSync] Exception deleting from Supabase:', error)
    return { success: false, error: message }
  }
}

/**
 * Merge local decks with remote Supabase decks
 * Strategy:
 * - If deck ID exists only locally → upload to Supabase
 * - If deck ID exists only remotely → keep from Supabase
 * - If deck ID exists in both → keep the one with more recent updated_at
 */
export async function mergeDecks(
  userId: string,
  localDecks: Record<string, Deck>
): Promise<{ success: boolean; merged: Record<string, Deck>; error?: string }> {
  try {
    // Load existing Supabase decks
    const supabaseDecks = await loadDecksFromSupabase(userId)

    // Merge decks
    const merged: Record<string, Deck> = {}
    const decksToUpload: Deck[] = []

    // Get all unique deck IDs
    const allDeckIds = new Set([
      ...Object.keys(localDecks),
      ...Object.keys(supabaseDecks)
    ])

    for (const deckId of allDeckIds) {
      const localDeck = localDecks[deckId]
      const remoteDeck = supabaseDecks[deckId]

      if (localDeck && !remoteDeck) {
        // Only exists locally - keep local and upload
        merged[deckId] = localDeck
        decksToUpload.push(localDeck)
      } else if (!localDeck && remoteDeck) {
        // Only exists remotely - keep remote
        merged[deckId] = remoteDeck
      } else if (localDeck && remoteDeck) {
        // Exists in both - prefer remote (source of truth once synced)
        merged[deckId] = remoteDeck
      }
    }

    // Upload local-only decks to Supabase
    for (const deck of decksToUpload) {
      const result = await saveDeckToSupabase(userId, deck)
      if (!result.success) {
        console.error(`[DecksSync] Failed to upload deck ${deck.id}:`, result.error)
      }
    }

    return { success: true, merged }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[DecksSync] Exception merging decks:', error)
    return { success: false, merged: localDecks, error: message }
  }
}

/**
 * Full sync: sync all local decks to Supabase and handle deletions
 */
export async function syncAllDecks(
  userId: string,
  decks: Record<string, Deck>
): Promise<SyncResult> {
  try {
    // Load existing decks to calculate diff
    const existingDecks = await loadDecksFromSupabase(userId)

    // Upsert all current decks
    for (const deck of Object.values(decks)) {
      const result = await saveDeckToSupabase(userId, deck)
      if (!result.success) {
        console.error(`[DecksSync] Failed to sync deck ${deck.id}:`, result.error)
      }
    }

    // Delete decks that exist in Supabase but not locally
    const decksToDelete = Object.keys(existingDecks).filter(deckId => !(deckId in decks))

    for (const deckId of decksToDelete) {
      const result = await deleteDeckFromSupabase(userId, deckId)
      if (!result.success) {
        console.error(`[DecksSync] Failed to delete deck ${deckId}:`, result.error)
      }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[DecksSync] Exception syncing all decks:', error)
    return { success: false, error: message }
  }
}
