<script lang="ts">
  import type { Card } from '../types';
  import { collection } from '../stores/collection';

  let { card }: { card: Card } = $props();

  // Reactive quantity check using store subscription
  const hasCard = $derived($collection[card.id] > 0);

  function handleClick() {
    if (hasCard) {
      // If card is already in collection, remove it
      collection.decrement(card.id);
    } else {
      // If card is not in collection, add it
      const result = collection.increment(card.id);
      if (!result.success) {
        console.warn('Max quantity reached');
      }
    }
  }
</script>

<div
  role="button"
  tabindex="0"
  class="card-item relative group cursor-pointer transition-opacity duration-200 hover:opacity-70"
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

  <!-- Checkmark Overlay (conditional) -->
  {#if hasCard}
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="w-16 h-16 rounded-full bg-gradient-to-br from-teal-600 to-emerald-500
                  flex items-center justify-center shadow-2xl animate-scale-in">
        <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>
  {/if}
</div>
