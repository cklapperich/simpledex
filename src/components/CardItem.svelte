<script lang="ts">
  import type { Card } from '../types';
  import { collection } from '../stores/collection';
  import { wishlist } from '../stores/wishlist';
  import { getContext } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { Star } from 'lucide-svelte';
  import { getAllCardImageUrls } from '../utils/cardImage';
  import { getCardName } from '../utils/cardUtils';

  interface Props {
    card: Card;
    collection?: Record<string, number>;
    wishlist?: Record<string, boolean>;
  }

  let { card, collection: propCollection, wishlist: propWishlist }: Props = $props();

  // Get mode from context (defaults to 'collection' if not provided)
  const modeContext = getContext<(() => 'collection' | 'wishlist') | undefined>('mode');
  const mode = $derived(modeContext ? modeContext() : 'collection');

  // Get readOnly flag from context
  const readOnly = getContext<boolean>('readOnly') || false;

  // Use props if in read-only mode, otherwise use stores
  const activeCollection = $derived(propCollection || $collection);
  const activeWishlist = $derived(propWishlist || $wishlist);

  // Reactive quantity check
  const hasCard = $derived(activeCollection[card.id] > 0);
  const quantity = $derived(activeCollection[card.id] || 0);
  const isOnWishlist = $derived(activeWishlist[card.id] === true);

  // Get all available image URLs (primary + backups)
  const imageUrls = $derived(getAllCardImageUrls(card, 'en'));
  let currentImageIndex = $state(0);

  // Current image URL (tries backup if primary fails)
  const imageUrl = $derived(imageUrls[currentImageIndex] || '');

  // Get card name
  const cardName = $derived(getCardName(card));

  function handleClick() {
    // Do nothing if in read-only mode
    if (readOnly) return;

    if (mode === 'wishlist') {
      // Toggle wishlist
      const result = wishlist.toggle(card.id);
      if (result.success && result.addedNew) {
        toast.success('Added to wishlist', {
          description: cardName,
          duration: 2000
        });
      } else if (result.success && result.removed) {
        toast.info('Removed from wishlist', {
          description: cardName,
          duration: 2000
        });
      }
    } else {
      // Collection mode: increment the counter
      const result = collection.increment(card.id);
      if (!result.success) {
        console.warn('Max quantity reached');
      } else if (result.addedNew) {
        toast.success('Added to collection', {
          description: cardName,
          duration: 2000
        });
      }
    }
  }

  function handleIncrement(e: Event) {
    e.stopPropagation();
    if (readOnly) return;
    const result = collection.increment(card.id);
    if (!result.success) {
      console.warn('Max quantity reached');
    }
  }

  function handleDecrement(e: Event) {
    e.stopPropagation();
    if (readOnly) return;
    collection.decrement(card.id);
  }

  let imageError = $state(false);

  function handleImageError() {
    // Try next image if available
    if (currentImageIndex < imageUrls.length - 1) {
      currentImageIndex++;
    } else {
      // No more images to try - show fallback UI
      imageError = true;
    }
  }

  // Reset state when card changes
  $effect(() => {
    // Track dependencies: card.id and imageUrls
    card.id;
    imageUrls;
    currentImageIndex = 0;
    imageError = false;
  });
</script>

<div
  role="button"
  tabindex="0"
  class="relative group transition-opacity duration-200 {readOnly ? '' : 'cursor-pointer hover:opacity-70'}"
  onclick={handleClick}
  onkeydown={(e) => e.key === 'Enter' && handleClick()}
>
  <!-- Card Image Container -->
  <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
    {#if !imageError}
      <img
        src={imageUrl}
        alt={cardName}
        loading="lazy"
        class="w-full h-full object-cover"
        onerror={handleImageError}
      />
    {:else}
      <div class="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-gray-100 to-gray-200">
        <div class="text-center">
          <div class="text-sm font-semibold text-gray-700 mb-2">{cardName}</div>
          <div class="text-xs text-gray-500">{card.set}</div>
          <div class="text-xs text-gray-400 mt-1">#{card.number}</div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Quantity Controls and Wishlist Indicator -->
  {#if mode === 'wishlist'}
    <!-- Wishlist mode: Show collection quantity only (no buttons) -->
    {#if hasCard}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span class="min-w-[2.5rem] text-center font-bold text-2xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {quantity}
        </span>
      </div>
    {/if}

    <!-- Wishlist indicator (star badge - 48x48px) -->
    {#if isOnWishlist}
      <div class="absolute top-2 right-2 pointer-events-none">
        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 flex items-center justify-center shadow-xl ring-2 ring-amber-600">
          <Star class="w-7 h-7 text-amber-900 fill-amber-900" strokeWidth={2.5} />
        </div>
      </div>
    {/if}
  {:else}
    <!-- Collection mode: Show quantity controls normally -->
    {#if hasCard}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        {#if readOnly}
          <!-- Read-only mode: show quantity without buttons -->
          <span class="min-w-[2.5rem] text-center font-bold text-2xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {quantity}
          </span>
        {:else}
          <!-- Interactive mode: show buttons -->
          <div class="flex items-center gap-3 animate-scale-in pointer-events-auto">
            <button
              type="button"
              class="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-xl
                     flex items-center justify-center transition-colors shadow-xl"
              onclick={handleDecrement}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span class="min-w-[2.5rem] text-center font-bold text-2xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {quantity}
            </span>
            <button
              type="button"
              class="w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-xl
                     flex items-center justify-center transition-colors shadow-xl"
              onclick={handleIncrement}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
