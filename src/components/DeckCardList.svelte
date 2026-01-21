<script lang="ts">
  import type { Card } from '../types';
  import { sortDeckCards } from '../utils/deckUtils';
  import { cardMap } from '../stores/cards';

  let {
    deckCards,
    onRemoveCard
  }: {
    deckCards: Record<string, number>;
    onRemoveCard: (cardId: string) => void;
  } = $props();

  const sortedCards = $derived(sortDeckCards(deckCards, $cardMap));

  function handleRemove(cardId: string) {
    onRemoveCard(cardId);
  }
</script>

<div class="space-y-1">
  {#each sortedCards as { cardId, quantity, card } (cardId)}
    <div class="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg group">
      <!-- Card Image (small thumbnail) -->
      <div class="w-16 h-22 flex-shrink-0">
        <img
          src={card.image}
          alt={card.name}
          loading="lazy"
          class="w-full h-full object-cover rounded border border-gray-200"
        />
      </div>

      <!-- Card Info -->
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm truncate">{card.name}</div>
        <div class="text-xs text-gray-500">{card.set} {card.number}</div>
        <div class="text-xs text-gray-400">{card.supertype}</div>
      </div>

      <!-- Quantity Controls -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          class="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-bold
                 flex items-center justify-center transition-colors"
          onclick={() => handleRemove(cardId)}
          aria-label="Remove one"
        >
          −
        </button>
        <span class="w-8 text-center font-bold text-lg">
          {quantity}
        </span>
        <div class="w-7"></div> <!-- Spacer for alignment -->
      </div>
    </div>
  {/each}

  {#if sortedCards.length === 0}
    <div class="text-center text-gray-400 py-8">
      No cards in deck
    </div>
  {/if}
</div>
