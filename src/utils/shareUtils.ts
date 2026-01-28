import { supabase } from '../lib/supabase'
import { DEFAULT_CARD_VARIATION, DEFAULT_LANGUAGE } from '../constants'

/**
 * Generate cryptographically secure 8-character share code
 * Uses alphanumeric characters (a-z, A-Z, 0-9) = 62^8 combinations
 */
export function generateShareCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const array = new Uint8Array(8)
  crypto.getRandomValues(array)

  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[array[i] % chars.length]
  }

  return code
}

/**
 * Get or create share code for the current authenticated user
 * Returns the share code or null if not authenticated or on error
 */
export async function getOrCreateShareCode(userId: string): Promise<string | null> {
  try {
    // First, check if user already has a share code
    const { data: existing, error: fetchError } = await supabase
      .from('user_share_codes')
      .select('share_code')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected for new users
      console.error('Error fetching share code:', fetchError)
      return null
    }

    if (existing) {
      return existing.share_code
    }

    // Generate new share code with collision retry logic
    let attempts = 0
    const maxAttempts = 5

    while (attempts < maxAttempts) {
      const shareCode = generateShareCode()

      const { error: insertError } = await supabase
        .from('user_share_codes')
        .insert({
          user_id: userId,
          share_code: shareCode
        })

      if (!insertError) {
        return shareCode
      }

      // If duplicate share code (extremely rare), retry
      if (insertError.code === '23505') {
        attempts++
        console.log(`Share code collision, retrying (${attempts}/${maxAttempts})`)
        continue
      }

      // Other error - log and return null
      console.error('Error creating share code:', insertError)
      return null
    }

    console.error('Failed to generate unique share code after max attempts')
    return null
  } catch (error) {
    console.error('Exception in getOrCreateShareCode:', error)
    return null
  }
}

/**
 * Resolve a share code to its owner's user_id
 * Returns user_id or null if not found
 */
export async function resolveShareCode(shareCode: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_share_codes')
      .select('user_id')
      .eq('share_code', shareCode)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - share code doesn't exist
        return null
      }
      console.error('Error resolving share code:', error)
      return null
    }

    return data?.user_id || null
  } catch (error) {
    console.error('Exception resolving share code:', error)
    return null
  }
}

/**
 * Load collection data for a specific user (used by share view)
 * Returns collection as Record<cardId, quantity> or null on error
 */
export async function loadUserCollection(userId: string): Promise<Record<string, number> | null> {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('card_id, quantity')
      .eq('user_id', userId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', DEFAULT_LANGUAGE)

    if (error) {
      console.error('Error loading user collection:', error)
      return null
    }

    const collection: Record<string, number> = {}
    if (data) {
      for (const row of data) {
        collection[row.card_id] = row.quantity
      }
    }

    return collection
  } catch (error) {
    console.error('Exception loading user collection:', error)
    return null
  }
}

/**
 * Load wishlist data for a specific user (used by share view)
 * Returns wishlist as Record<cardId, true> or null on error
 */
export async function loadUserWishlist(userId: string): Promise<Record<string, boolean> | null> {
  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select('card_id')
      .eq('user_id', userId)
      .eq('variation', DEFAULT_CARD_VARIATION)
      .eq('language', DEFAULT_LANGUAGE)

    if (error) {
      console.error('Error loading user wishlist:', error)
      return null
    }

    const wishlist: Record<string, boolean> = {}
    if (data) {
      for (const row of data) {
        wishlist[row.card_id] = true
      }
    }

    return wishlist
  } catch (error) {
    console.error('Exception loading user wishlist:', error)
    return null
  }
}
