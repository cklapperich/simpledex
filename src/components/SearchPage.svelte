<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { Document } from 'flexsearch';
  import { setContext } from 'svelte';
  import type { Card } from '../types';
  import SearchBar from './SearchBar.svelte';
  import CardGrid from './CardGrid.svelte';
  import ExportButton from './ExportButton.svelte';
  import ImportButton from './ImportButton.svelte';
  import WishlistExportButton from './WishlistExportButton.svelte';
  import WishlistImportButton from './WishlistImportButton.svelte';
  import ModeToggle from './ModeToggle.svelte';
  import FilterColumn from './FilterColumn.svelte';
  import FilterModal from './FilterModal.svelte';
  import { allCards, cardMap, setMap, isLoading as cardsLoading } from '../stores/cards';
  import { collection, totalCards } from '../stores/collection';
  import { wishlist, totalWishlisted } from '../stores/wishlist';
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
  let showFilterModal = $state(false);
  let mode = $state<'collection' | 'wishlist'>('collection');

  // Set context so CardItem can access mode (only in collectionOnly view)
  if (collectionOnly) {
    setContext('mode', mode);
  }

  // Display cards: first 50 if no search, all matching if searching
  const displayedCards = $derived.by(() => {
    let cards: Card[] = [];

    if (collectionOnly) {
      // Collection/Wishlist mode: start with all cards based on active mode
      const sourceData = mode === 'collection' ? $collection : $wishlist;

      for (const cardId in sourceData) {
        // For collection: check if quantity > 0, for wishlist: check if true
        if (mode === 'collection' ? sourceData[cardId] > 0 : sourceData[cardId]) {
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

  $effect(() => {
    // Build FlexSearch index after cards are loaded
    if (!$cardsLoading && $allCards.length > 0 && !indexReady) {
      searchIndex = new Document({
        document: {
          id: 'id',
          index: ['name']  // Only index name field
        },
        tokenize: 'forward'
      });

      // Add all cards to index
      for (const card of $allCards) {
        searchIndex.add(card);
      }

      indexReady = true;
    }
  });
</script>

<div class="min-h-screen bg-white">
  <div class="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4">
    {#if collectionOnly}
      <!-- Collection/Wishlist Header -->
      <div class="mb-4">
        <!-- Mode Toggle -->
        <div class="mb-4">
          <ModeToggle bind:mode />
        </div>

        <!-- Header with title and buttons -->
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-4xl font-bold text-gray-900 mb-2">
              {mode === 'collection' ? 'Collection' : 'Wishlist'}
            </h1>
            <p class="text-gray-600">
              {#if mode === 'collection'}
                {#if $totalCards > 0}
                  {$totalCards} {$totalCards === 1 ? 'card' : 'cards'}
                {:else}
                  No cards yet
                {/if}
              {:else}
                {#if $totalWishlisted > 0}
                  {$totalWishlisted} {$totalWishlisted === 1 ? 'card' : 'cards'}
                {:else}
                  No cards yet
                {/if}
              {/if}
            </p>
          </div>
          <div class="flex gap-3">
            {#if mode === 'collection'}
              <ImportButton />
              <ExportButton />
            {:else}
              <WishlistImportButton />
              <WishlistExportButton />
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Search Bar -->
    <div class="mb-1">
      <SearchBar onSearch={handleSearch} />
    </div>

    <!-- Loading state -->
    {#if $cardsLoading || !indexReady}
      <div class="flex items-center justify-center py-20">
        <div class="text-gray-600">Loading {collectionOnly ? (mode === 'collection' ? 'collection' : 'wishlist') : 'cards'}...</div>
      </div>
    {:else if collectionOnly && ((mode === 'collection' && $totalCards === 0) || (mode === 'wishlist' && $totalWishlisted === 0))}
      <!-- Empty collection/wishlist state (only when truly empty) -->
      <div class="flex flex-col items-center justify-center py-20">
        <div class="text-gray-400 text-6xl mb-4">
          {#if mode === 'collection'}
            <svg class="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          {:else}
            <svg class="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          {/if}
        </div>
        <h2 class="text-2xl font-semibold text-gray-900 mb-2">
          {mode === 'collection' ? 'No cards in collection yet' : 'No cards on wishlist yet'}
        </h2>
        <p class="text-gray-600">
          {mode === 'collection' ? 'Go to Search to add cards to your collection' : 'Go to Search to add cards to your wishlist'}
        </p>
      </div>
    {:else}
      <!-- Filter bar (only in collection mode) -->
      {#if collectionOnly}
        <!-- Mobile Filters Button -->
        <div class="mb-2 md:hidden">
          <button
            onclick={() => showFilterModal = true}
            class="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {#if activeFilters.size > 0}
              <span class="bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                {activeFilters.size}
              </span>
            {/if}
          </button>
        </div>

        <!-- Desktop Filter Column -->
        <div class="mb-2 hidden md:block">
          <FilterColumn activeFilters={activeFilters} onToggle={handleFilterToggle} />
        </div>
        <div class="border-t border-gray-300 mb-4"></div>
      {/if}

      <!-- Cards display -->
      {#if displayedCards.length === 0}
        <!-- No results found (but collection has cards) -->
        <div class="flex flex-col items-center justify-center py-20">
          <div class="text-gray-400 mb-4">
            <svg class="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 class="text-2xl font-semibold text-gray-900 mb-2">No cards found</h2>
          <p class="text-gray-600">Try adjusting your search or filters</p>
        </div>
      {:else}
        <CardGrid cards={displayedCards} />
      {/if}
    {/if}
  </div>
</div>

<!-- Filter Modal (mobile only) -->
{#if showFilterModal && collectionOnly}
  <FilterModal
    activeFilters={activeFilters}
    onToggle={handleFilterToggle}
    onClose={() => showFilterModal = false}
  />
{/if}
