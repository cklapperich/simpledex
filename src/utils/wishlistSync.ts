import type { Wishlist } from '../types'
import {
  loadWishlistFromSupabase,
  saveWishlistToSupabase,
  deleteWishlistFromSupabase,
  mergeWishlistData,
  syncFullWishlistData,
  type SyncResult
} from './supabaseSync'

export { type SyncResult }

// Re-export with original names for backwards compatibility
export { loadWishlistFromSupabase as loadFromSupabase }
export { saveWishlistToSupabase as saveToSupabase }
export { deleteWishlistFromSupabase as deleteFromSupabase }
export { mergeWishlistData as mergeWishlists }
export { syncFullWishlistData as syncFullWishlist }
