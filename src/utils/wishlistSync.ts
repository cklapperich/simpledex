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

export const loadFromSupabase = loadWishlistFromSupabase

export async function saveToSupabase(
  userId: string,
  cardId: string
): Promise<SyncResult> {
  return saveWishlistToSupabase(userId, cardId)
}

export const deleteFromSupabase = deleteWishlistFromSupabase

export async function mergeWishlists(
  userId: string,
  localWishlist: Wishlist
): Promise<SyncResult> {
  return mergeWishlistData(userId, localWishlist)
}

export async function syncFullWishlist(
  userId: string,
  wishlist: Wishlist
): Promise<SyncResult> {
  return syncFullWishlistData(userId, wishlist)
}
