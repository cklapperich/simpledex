<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { Document } from 'flexsearch';
  import type { Card } from '../types';
  import SearchBar from './SearchBar.svelte';
  import CardGrid from './CardGrid.svelte';
  import ExportButton from './ExportButton.svelte';
  import ImportButton from './ImportButton.svelte';
  import FilterColumn from './FilterColumn.svelte';
  import { allCards, cardMap, setMap, isLoading as cardsLoading } from '../stores/cards';
  import { collection, totalCards } from '../stores/collection';
  import { MODERN_SERIES } from '../constants';
  import { sortCardsBySetAndNumber, sortCardsByReleaseDate } from '../utils/cardSorting';
  import { matchesFilters, normalizeSetName } from '../utils/cardFilters';

  interface Props {
    collectionOnly?: boolean;
  }

  let { collectionOnly = false }: Props = $props();

  let searchQuery = $state('');
  let modernOnly = $state(false);
  let indexReady = $state(false);
  let searchIndex: Document<Card>;
  let activeFilters = $state(new SvelteSet<string>());

  // Display cards: first 50 if no search, all matching if searching
  const displayedCards = $derived.by(() => {
    let cards: Card[] = [];

    if (collectionOnly) {
      // Collection mode: start with all cards in collection
      const collectionData = $collection;
      for (const cardId in collectionData) {
        if (collectionData[cardId] > 0) {
          const card = $cardMap.get(cardId);
          if (card) {
            cards.push(card);
          }
        }
      }

      // Apply search filter if query exists
      if (searchQuery.trim()) {
        const query = searchQuery.trim();
        const queryLower = normalizeSetName(query);

        // Filter by set name or pokemon name
        cards = cards.filter(card => {
          return (
            card.name.toLowerCase().includes(queryLower) ||
            card.set.toLowerCase().includes(queryLower) ||
            card.setNumber.toLowerCase().includes(queryLower)
          );
        });
      }
    } else {
      // Search mode: regular search behavior
      if (!searchQuery.trim()) {
        // No search - show only first 50 cards
        cards = $allCards.slice(0, 50);
      } else {
        const query = searchQuery.trim();
        const queryLower = normalizeSetName(query);

        // Check if query matches a set name exactly (case-insensitive) using pre-built index
        const setCards = $setMap.get(queryLower);
        if (setCards) {
          cards = [...setCards];
        } else {
          // Search pokemon names using FlexSearch
          const results = searchIndex.search(query, { field: 'name' });

          // FlexSearch returns results grouped by field, flatten and lookup cards
          const cardSet = new SvelteSet<string>();

          for (const fieldResult of results) {
            for (const cardId of fieldResult.result) {
              if (!cardSet.has(cardId)) {
                cardSet.add(cardId);
                const card = $cardMap.get(cardId);
                if (card) {
                  cards.push(card);
                }
              }
            }
          }
        }
      }
    }

    // Apply modern only filter
    if (modernOnly) {
      cards = cards.filter(card => MODERN_SERIES.includes(card.series));
    }

    // Apply active filters
    if (activeFilters.size > 0) {
      cards = cards.filter(card => matchesFilters(card, activeFilters));
    }

    // Sort logic
    if (collectionOnly) {
      // Collection mode: sort by set name, then by number
      sortCardsBySetAndNumber(cards);
    } else {
      // Search mode: sort by release date (newest first)
      sortCardsByReleaseDate(cards);
    }

    return cards;
  });

  // Search handler
  function handleSearch(query: string) {
    searchQuery = query;
  }

  // Filter toggle handler
  function handleFilterToggle(filter: string) {
    const newFilters = new SvelteSet(activeFilters);
    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      newFilters.add(filter);
    }
    activeFilters = newFilters;
  }

  onMount(() => {
    // Build FlexSearch index client-side from allCards
    searchIndex = new Document({
      document: {
        id: 'id',
        index: ['name']  // Only index name field
      },
      tokenize: 'forward'
    });

    // Add all cards to index (fast - runs after cards are loaded)
    for (const card of $allCards) {
      searchIndex.add(card);
    }

    indexReady = true;
  });
</script>

<div class="min-h-screen bg-white">
  <div class="max-w-7xl mx-auto px-8 py-4">
    {#if collectionOnly}
      <!-- Collection Header -->
      <div class="mb-2 flex items-start justify-between">
        <div>
          <h1 class="text-4xl font-bold text-gray-900 mb-2">My Collection</h1>
          <p class="text-gray-600">
            {#if $totalCards > 0}
              {$totalCards} {$totalCards === 1 ? 'card' : 'cards'} in your collection
            {:else}
              No cards yet
            {/if}
          </p>
        </div>
        <div class="flex gap-3">
          <ImportButton />
          <ExportButton />
        </div>
      </div>
    {/if}

    <!-- Search Bar -->
    <div class="mb-1">
      <SearchBar onSearch={handleSearch} />

      <!-- Modern Only Filter -->
      <div class="mt-1">
        <label class="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            bind:checked={modernOnly}
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span class="ml-2 text-sm text-gray-700">Modern Only (Black & White onwards)</span>
        </label>
      </div>
    </div>

    <!-- Loading state -->
    {#if $cardsLoading || !indexReady}
      <div class="flex items-center justify-center py-20">
        <div class="text-gray-600">Loading {collectionOnly ? 'collection' : 'cards'}...</div>
      </div>
    {:else if collectionOnly && $totalCards === 0}
      <!-- Empty collection state (only when truly empty) -->
      <div class="flex flex-col items-center justify-center py-20">
        <div class="text-gray-400 text-6xl mb-4">📦</div>
        <h2 class="text-2xl font-semibold text-gray-900 mb-2">No cards in collection yet</h2>
        <p class="text-gray-600">Go to Search to add cards to your collection</p>
      </div>
    {:else}
      <!-- Filter bar (only in collection mode) -->
      {#if collectionOnly}
        <div class="mb-2">
          <FilterColumn activeFilters={activeFilters} onToggle={handleFilterToggle} />
        </div>
        <div class="border-t border-gray-300 mb-4"></div>
      {/if}

      <!-- Cards display -->
      {#if displayedCards.length === 0}
        <!-- No results found (but collection has cards) -->
        <div class="flex flex-col items-center justify-center py-20">
          <div class="text-gray-400 text-6xl mb-4">🔍</div>
          <h2 class="text-2xl font-semibold text-gray-900 mb-2">No cards found</h2>
          <p class="text-gray-600">Try adjusting your search or filters</p>
        </div>
      {:else}
        <CardGrid cards={displayedCards} />
      {/if}
    {/if}
  </div>
</div>
