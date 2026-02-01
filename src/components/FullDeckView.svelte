<script lang="ts">
  import type { Card } from '../types';
  import DeckStats from './DeckStats.svelte';
  import CollapsibleSection from './CollapsibleSection.svelte';
  import { cardMap } from '../stores/cards';
  import { calculateDeckStats, groupDeckCards, type GroupedDeckCards } from '../utils/deckStats';
  import { getCardImageUrl } from '../utils/cardImage';

  interface Props {
    deckCards: Record<string, number>;
    onAddCard: (cardId: string) => void;
    onRemoveCard: (cardId: string) => void;
  }

  const { deckCards, onAddCard, onRemoveCard }: Props = $props();

  // Helper to get card name
  function getCardName(card: Card): string {
    return card.names['en'] || card.names[Object.keys(card.names)[0]] || 'Unknown';
  }

  // Calculate stats and grouped cards
  const stats = $derived(calculateDeckStats(deckCards, $cardMap));
  const groupedCards = $derived(groupDeckCards(deckCards, $cardMap));

  // Count helpers for sections
  const pokemonCount = $derived(stats.pokemon);
  const pokemonBasicCount = $derived(groupedCards.pokemon.basic.reduce((sum, c) => sum + c.quantity, 0));
  const pokemonStage1Count = $derived(groupedCards.pokemon.stage1.reduce((sum, c) => sum + c.quantity, 0));
  const pokemonStage2Count = $derived(groupedCards.pokemon.stage2.reduce((sum, c) => sum + c.quantity, 0));

  const trainersCount = $derived(stats.trainers);
  const supportersCount = $derived(groupedCards.trainers.supporters.reduce((sum, c) => sum + c.quantity, 0));
  const itemsCount = $derived(groupedCards.trainers.items.reduce((sum, c) => sum + c.quantity, 0));
  const toolsCount = $derived(groupedCards.trainers.tools.reduce((sum, c) => sum + c.quantity, 0));

  const energyCount = $derived(stats.energy);
  const basicEnergyCount = $derived(groupedCards.energy.basic.reduce((sum, c) => sum + c.quantity, 0));
  const specialEnergyCount = $derived(groupedCards.energy.special.reduce((sum, c) => sum + c.quantity, 0));
</script>

<div class="p-4 md:p-6 space-y-6">
  <!-- Deck Stats at the top -->
  <div class="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
    <h2 class="text-lg font-semibold text-gray-900 mb-3">Deck Statistics</h2>
    <DeckStats {stats} />
  </div>

  <!-- Pokemon Section -->
  <CollapsibleSection title="Pokemon" count={pokemonCount} defaultOpen={true}>
    <div class="ml-4 space-y-2">
      <!-- Basic Pokemon -->
      {#if groupedCards.pokemon.basic.length > 0}
        <CollapsibleSection title="Basic" count={pokemonBasicCount} defaultOpen={true}>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
            {#each groupedCards.pokemon.basic as { cardId, quantity, card } (cardId)}
              <div class="relative">
                <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                  <img
                    src={getCardImageUrl(card, 'en')}
                    alt={getCardName(card)}
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                </div>
                <!-- +/- Overlay Buttons -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onRemoveCard(cardId)}
                      aria-label="Remove from deck"
                    >
                      -
                    </button>
                    <span class="min-w-[2rem] text-center font-bold text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onAddCard(cardId)}
                      aria-label="Add to deck"
                    >
                      +
                    </button>
                  </div>
                </div>
                <!-- Card Name -->
                <div class="mt-1 text-center">
                  <p class="text-sm font-medium text-gray-900 truncate">{getCardName(card)}</p>
                  <p class="text-xs text-gray-500">x{quantity}</p>
                </div>
              </div>
            {/each}
          </div>
        </CollapsibleSection>
      {/if}

      <!-- Stage 1 Pokemon -->
      {#if groupedCards.pokemon.stage1.length > 0}
        <CollapsibleSection title="Stage 1" count={pokemonStage1Count} defaultOpen={true}>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
            {#each groupedCards.pokemon.stage1 as { cardId, quantity, card } (cardId)}
              <div class="relative">
                <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                  <img
                    src={getCardImageUrl(card, 'en')}
                    alt={getCardName(card)}
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                </div>
                <!-- +/- Overlay Buttons -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onRemoveCard(cardId)}
                      aria-label="Remove from deck"
                    >
                      -
                    </button>
                    <span class="min-w-[2rem] text-center font-bold text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onAddCard(cardId)}
                      aria-label="Add to deck"
                    >
                      +
                    </button>
                  </div>
                </div>
                <!-- Card Name -->
                <div class="mt-1 text-center">
                  <p class="text-sm font-medium text-gray-900 truncate">{getCardName(card)}</p>
                  <p class="text-xs text-gray-500">x{quantity}</p>
                </div>
              </div>
            {/each}
          </div>
        </CollapsibleSection>
      {/if}

      <!-- Stage 2 Pokemon -->
      {#if groupedCards.pokemon.stage2.length > 0}
        <CollapsibleSection title="Stage 2" count={pokemonStage2Count} defaultOpen={true}>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
            {#each groupedCards.pokemon.stage2 as { cardId, quantity, card } (cardId)}
              <div class="relative">
                <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                  <img
                    src={getCardImageUrl(card, 'en')}
                    alt={getCardName(card)}
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                </div>
                <!-- +/- Overlay Buttons -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onRemoveCard(cardId)}
                      aria-label="Remove from deck"
                    >
                      -
                    </button>
                    <span class="min-w-[2rem] text-center font-bold text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onAddCard(cardId)}
                      aria-label="Add to deck"
                    >
                      +
                    </button>
                  </div>
                </div>
                <!-- Card Name -->
                <div class="mt-1 text-center">
                  <p class="text-sm font-medium text-gray-900 truncate">{getCardName(card)}</p>
                  <p class="text-xs text-gray-500">x{quantity}</p>
                </div>
              </div>
            {/each}
          </div>
        </CollapsibleSection>
      {/if}
    </div>
  </CollapsibleSection>

  <!-- Trainers Section -->
  <CollapsibleSection title="Trainers" count={trainersCount} defaultOpen={true}>
    <div class="ml-4 space-y-2">
      <!-- Supporters -->
      {#if groupedCards.trainers.supporters.length > 0}
        <CollapsibleSection title="Supporters" count={supportersCount} defaultOpen={true}>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
            {#each groupedCards.trainers.supporters as { cardId, quantity, card } (cardId)}
              <div class="relative">
                <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                  <img
                    src={getCardImageUrl(card, 'en')}
                    alt={getCardName(card)}
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                </div>
                <!-- +/- Overlay Buttons -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onRemoveCard(cardId)}
                      aria-label="Remove from deck"
                    >
                      -
                    </button>
                    <span class="min-w-[2rem] text-center font-bold text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onAddCard(cardId)}
                      aria-label="Add to deck"
                    >
                      +
                    </button>
                  </div>
                </div>
                <!-- Card Name -->
                <div class="mt-1 text-center">
                  <p class="text-sm font-medium text-gray-900 truncate">{getCardName(card)}</p>
                  <p class="text-xs text-gray-500">x{quantity}</p>
                </div>
              </div>
            {/each}
          </div>
        </CollapsibleSection>
      {/if}

      <!-- Items -->
      {#if groupedCards.trainers.items.length > 0}
        <CollapsibleSection title="Items" count={itemsCount} defaultOpen={true}>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
            {#each groupedCards.trainers.items as { cardId, quantity, card } (cardId)}
              <div class="relative">
                <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                  <img
                    src={getCardImageUrl(card, 'en')}
                    alt={getCardName(card)}
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                </div>
                <!-- +/- Overlay Buttons -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onRemoveCard(cardId)}
                      aria-label="Remove from deck"
                    >
                      -
                    </button>
                    <span class="min-w-[2rem] text-center font-bold text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onAddCard(cardId)}
                      aria-label="Add to deck"
                    >
                      +
                    </button>
                  </div>
                </div>
                <!-- Card Name -->
                <div class="mt-1 text-center">
                  <p class="text-sm font-medium text-gray-900 truncate">{getCardName(card)}</p>
                  <p class="text-xs text-gray-500">x{quantity}</p>
                </div>
              </div>
            {/each}
          </div>
        </CollapsibleSection>
      {/if}

      <!-- Tools -->
      {#if groupedCards.trainers.tools.length > 0}
        <CollapsibleSection title="Tools" count={toolsCount} defaultOpen={true}>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
            {#each groupedCards.trainers.tools as { cardId, quantity, card } (cardId)}
              <div class="relative">
                <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                  <img
                    src={getCardImageUrl(card, 'en')}
                    alt={getCardName(card)}
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                </div>
                <!-- +/- Overlay Buttons -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onRemoveCard(cardId)}
                      aria-label="Remove from deck"
                    >
                      -
                    </button>
                    <span class="min-w-[2rem] text-center font-bold text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onAddCard(cardId)}
                      aria-label="Add to deck"
                    >
                      +
                    </button>
                  </div>
                </div>
                <!-- Card Name -->
                <div class="mt-1 text-center">
                  <p class="text-sm font-medium text-gray-900 truncate">{getCardName(card)}</p>
                  <p class="text-xs text-gray-500">x{quantity}</p>
                </div>
              </div>
            {/each}
          </div>
        </CollapsibleSection>
      {/if}
    </div>
  </CollapsibleSection>

  <!-- Energy Section -->
  <CollapsibleSection title="Energy" count={energyCount} defaultOpen={true}>
    <div class="ml-4 space-y-2">
      <!-- Basic Energy -->
      {#if groupedCards.energy.basic.length > 0}
        <CollapsibleSection title="Basic" count={basicEnergyCount} defaultOpen={true}>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
            {#each groupedCards.energy.basic as { cardId, quantity, card } (cardId)}
              <div class="relative">
                <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                  <img
                    src={getCardImageUrl(card, 'en')}
                    alt={getCardName(card)}
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                </div>
                <!-- +/- Overlay Buttons -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onRemoveCard(cardId)}
                      aria-label="Remove from deck"
                    >
                      -
                    </button>
                    <span class="min-w-[2rem] text-center font-bold text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onAddCard(cardId)}
                      aria-label="Add to deck"
                    >
                      +
                    </button>
                  </div>
                </div>
                <!-- Card Name -->
                <div class="mt-1 text-center">
                  <p class="text-sm font-medium text-gray-900 truncate">{getCardName(card)}</p>
                  <p class="text-xs text-gray-500">x{quantity}</p>
                </div>
              </div>
            {/each}
          </div>
        </CollapsibleSection>
      {/if}

      <!-- Special Energy -->
      {#if groupedCards.energy.special.length > 0}
        <CollapsibleSection title="Special" count={specialEnergyCount} defaultOpen={true}>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
            {#each groupedCards.energy.special as { cardId, quantity, card } (cardId)}
              <div class="relative">
                <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                  <img
                    src={getCardImageUrl(card, 'en')}
                    alt={getCardName(card)}
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                </div>
                <!-- +/- Overlay Buttons -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onRemoveCard(cardId)}
                      aria-label="Remove from deck"
                    >
                      -
                    </button>
                    <span class="min-w-[2rem] text-center font-bold text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg flex items-center justify-center transition-colors shadow-lg"
                      onclick={() => onAddCard(cardId)}
                      aria-label="Add to deck"
                    >
                      +
                    </button>
                  </div>
                </div>
                <!-- Card Name -->
                <div class="mt-1 text-center">
                  <p class="text-sm font-medium text-gray-900 truncate">{getCardName(card)}</p>
                  <p class="text-xs text-gray-500">x{quantity}</p>
                </div>
              </div>
            {/each}
          </div>
        </CollapsibleSection>
      {/if}
    </div>
  </CollapsibleSection>

  <!-- Empty State -->
  {#if stats.total === 0}
    <div class="text-center py-12">
      <div class="text-gray-400 text-5xl mb-4">+</div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">No cards in deck</h3>
      <p class="text-gray-600">Add cards from your collection using the card browser</p>
    </div>
  {/if}
</div>
