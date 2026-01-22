<script lang="ts">
  import type { Card } from '../types';
  import { collection } from '../stores/collection';
  import { wishlist } from '../stores/wishlist';
  import { getContext } from 'svelte';
  import { toast } from 'svelte-sonner';

  let { card }: { card: Card } = $props();

  // Get mode from context (defaults to 'collection' if not in collectionOnly view)
  const mode = getContext<'collection' | 'wishlist'>('mode') || 'collection';

  // Reactive quantity check using store subscription
  const hasCard = $derived($collection[card.id] > 0);
  const quantity = $derived($collection[card.id] || 0);
  const isOnWishlist = $derived($wishlist[card.id] === true);

  function handleClick() {
    if (mode === 'wishlist') {
      // Toggle wishlist
      const result = wishlist.toggle(card.id);
      if (result.success && result.addedNew) {
        toast.success('Added to wishlist', {
          description: card.name,
          duration: 2000
        });
      } else if (result.success && result.removed) {
        toast.info('Removed from wishlist', {
          description: card.name,
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
          description: card.name,
          duration: 2000
        });
      }
    }
  }

  function handleIncrement(e: Event) {
    e.stopPropagation();
    const result = collection.increment(card.id);
    if (!result.success) {
      console.warn('Max quantity reached');
    }
  }

  function handleDecrement(e: Event) {
    e.stopPropagation();
    collection.decrement(card.id);
  }
</script>

<div
  role="button"
  tabindex="0"
  class="relative group cursor-pointer transition-opacity duration-200 hover:opacity-70"
  onclick={handleClick}
  onkeydown={(e) => e.key === 'Enter' && handleClick()}
>
  <!-- Card Image Container -->
  <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
    <img
      src={card.image}
      alt={card.name}
      loading="lazy"
      class="w-full h-full object-cover"
    />
  </div>

  <!-- Quantity Controls and Wishlist Indicator -->
  {#if mode === 'wishlist'}
    <!-- Wishlist mode: Show collection controls dimmed (40% opacity) -->
    {#if hasCard}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
        <div class="flex items-center gap-3 animate-scale-in">
          <button
            type="button"
            class="w-10 h-10 rounded-full bg-red-500 text-white font-bold text-xl
                   flex items-center justify-center shadow-xl"
            aria-label="Decrease quantity"
            disabled
          >
            −
          </button>
          <span class="min-w-[2.5rem] text-center font-bold text-2xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {quantity}
          </span>
          <button
            type="button"
            class="w-10 h-10 rounded-full bg-green-500 text-white font-bold text-xl
                   flex items-center justify-center shadow-xl"
            aria-label="Increase quantity"
            disabled
          >
            +
          </button>
        </div>
      </div>
    {/if}

    <!-- Wishlist indicator (star badge - 48x48px) -->
    {#if isOnWishlist}
      <div class="absolute top-2 right-2 pointer-events-none">
        <div class="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center shadow-xl">
          <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
      </div>
    {/if}
  {:else}
    <!-- Collection mode: Show quantity controls normally -->
    {#if hasCard}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
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
      </div>
    {/if}
  {/if}
</div>
