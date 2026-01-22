<script lang="ts">
  import type { Card } from '../types';
  import CardItem from './CardItem.svelte';

  let { cards }: { cards: Card[] } = $props();
</script>

{#if cards.length === 0}
  <div class="flex flex-col items-center justify-center py-20 text-center">
    <div class="text-gray-400 mb-2">
      <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <p class="text-lg font-medium text-gray-900 mb-1">No cards found</p>
    <p class="text-sm text-gray-600">Try searching by name, set, or card number</p>
  </div>
{:else}
  <div class="grid grid-cols-2 landscape:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
    {#each cards as card (card.id)}
      <CardItem {card} />
    {/each}
  </div>
{/if}
