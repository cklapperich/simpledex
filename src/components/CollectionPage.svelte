<script lang="ts">
  import { onMount } from 'svelte';
  import type { Card } from '../types';
  import { collection, totalCards } from '../stores/collection';
  import CardGrid from './CardGrid.svelte';

  let allCards = $state<Card[]>([]);
  let isLoading = $state(true);

  // Filter to only show cards in collection
  const collectionCards = $derived.by(() => {
    const collectionData = $collection;
    return allCards.filter(card => collectionData[card.id]);
  });

  onMount(async () => {
    try {
      const response = await fetch('/cards.json');
      if (!response.ok) {
        throw new Error('Failed to load cards');
      }
      allCards = await response.json();
    } catch (error) {
      console.error('Error loading cards:', error);
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="min-h-screen bg-white">
  <div class="max-w-7xl mx-auto px-8 py-12">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-2">My Collection</h1>
      <p class="text-gray-600">
        {#if $totalCards > 0}
          {$totalCards} {$totalCards === 1 ? 'card' : 'cards'} in your collection
        {:else}
          No cards yet
        {/if}
      </p>
    </div>

    <!-- Loading state -->
    {#if isLoading}
      <div class="flex items-center justify-center py-20">
        <div class="text-gray-600">Loading collection...</div>
      </div>
    {:else if collectionCards.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-20">
        <div class="text-gray-400 text-6xl mb-4">📦</div>
        <h2 class="text-2xl font-semibold text-gray-900 mb-2">No cards in collection yet</h2>
        <p class="text-gray-600">Go to Search to add cards to your collection</p>
      </div>
    {:else}
      <!-- Collection grid -->
      <CardGrid cards={collectionCards} />
    {/if}
  </div>
</div>
