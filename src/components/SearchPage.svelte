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
  import ShareButton from './ShareButton.svelte';
    import FilterColumn from './FilterColumn.svelte';
  import FilterModal from './FilterModal.svelte';
  import { allCards, cardMap, setMap, isLoading as cardsLoading } from '../stores/cards';
  import { collection, totalCards } from '../stores/collection';
  import { wishlist, totalWishlisted } from '../stores/wishlist';
  import { MODERN_SERIES } from '../constants';
  import { sortCardsBySetAndNumber, sortCardsByReleaseDate } from '../utils/cardSorting';
  import { matchesFilters, saveFilters, loadFilters } from '../utils/cardFilters';
  import { parseSearchQuery, hasFilters } from '../utils/searchQueryParser';
  import { matchesSearchFilters } from '../utils/searchFilters';
  import { getCardName } from '../utils/cardUtils';

  // Page mode: 'add' = search cards to add to collection, 'search' = search within your collection
  let pageMode = $state<'add' | 'search'>('add');

  // Derive collectionOnly from pageMode
  const collectionOnly = $derived(pageMode === 'search');

  // Determine localStorage key for filters (reactive to collectionOnly changes)
  const filterKey = $derived(collectionOnly ? 'collection-filters' : 'search-filters');

  let searchQuery = $state('');
  let visibleCount = $state(60);

  // Reset search query and pagination when switching modes
  $effect(() => {
    // Track collectionOnly to trigger reset on mode change
    const _ = collectionOnly;
    // Always reset to empty
    searchQuery = '';
    visibleCount = 60;
  });
  let modernOnly = $state(false);
  let indexReady = $state(false);
  let searchIndex: Document<Card>;
  let activeFilters = $state(new SvelteSet<string>());
  let showFilterModal = $state(false);
  let mode = $state<'collection' | 'wishlist'>('collection');

  // Set context so CardItem can access mode - pass getter function to make it reactive
  setContext('mode', () => mode);

  // All filtered cards (before pagination)
  const allFilteredCards = $derived.by(() => {
    let cards: Card[] = [];

    // Parse the search query to extract structured filters (artist:value, etc.)
    const parsedQuery = parseSearchQuery(searchQuery);
    const searchText = parsedQuery.text;
    const searchFilters = parsedQuery.filters;
    const hasSearchFilters = hasFilters(searchFilters);

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

      // Apply text search filter if text exists (after extracting structured filters)
      if (searchText) {
        const queryLower = searchText.toLowerCase();

        // Filter by set name or pokemon name
        cards = cards.filter(card => {
          return (
            getCardName(card).toLowerCase().includes(queryLower) ||
            card.set.toLowerCase().includes(queryLower) ||
            card.setNumber?.toLowerCase().includes(queryLower)
          );
        });
      }
    } else {
      // Search mode
      const hasTextSearch = searchText.length > 0;

      if (!hasTextSearch) {
        // No text search - start from all cards (filters will narrow down)
        cards = [...$allCards];
      } else {
        // Has text search
        const queryLower = searchText.toLowerCase();

        // Check if query matches a set name exactly (case-insensitive) using pre-built index
        const setCards = $setMap.get(queryLower);
        if (setCards) {
          cards = [...setCards];
        } else {
          // Search pokemon names using FlexSearch
          const results = searchIndex.search(searchText, { field: 'name' });

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

    // Apply structured search filters (artist:, etc.)
    if (hasSearchFilters) {
      cards = cards.filter(card => matchesSearchFilters(card, searchFilters));
    }

    // Apply modern only filter
    if (modernOnly) {
      cards = cards.filter(card => MODERN_SERIES.includes(card.series));
    }

    // Apply active filters (type, rarity, etc. from FilterColumn)
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

  // Paginated cards for display
  const displayedCards = $derived(allFilteredCards.slice(0, visibleCount));
  const hasMore = $derived(visibleCount < allFilteredCards.length);

  function loadMore() {
    visibleCount += 60;
  }

  // Search handler
  function handleSearch(query: string) {
    searchQuery = query;
    visibleCount = 60;
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
    visibleCount = 60;
  }

  $effect(() => {
    // Build FlexSearch index after cards are loaded
    if (!$cardsLoading && $allCards.length > 0) {
      console.log(`Building search index for ${$allCards.length} cards`);

      searchIndex = new Document({
        document: {
          id: 'id',
          index: ['name']
        },
        tokenize: 'forward'
      });

      // Add all filtered cards to index
      for (const card of $allCards) {
        const searchableCard = {
          id: card.id,
          name: getCardName(card)
        };
        searchIndex.add(searchableCard);
      }

      indexReady = true;
    }
  });

  // Load filters from localStorage when filterKey changes
  $effect(() => {
    activeFilters = new SvelteSet<string>(loadFilters(filterKey));
  });

  // Save filters to localStorage whenever they change
  $effect(() => {
    saveFilters(filterKey, activeFilters);
  });
</script>

<div class="min-h-screen bg-white">
  <div class="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4">
    <!-- Page Mode Selector and Mode Toggle -->
    <div class="mb-4 flex flex-wrap gap-4 items-center">
      <!-- Page Mode Selector (Add vs Search Collection) -->
      <div class="inline-flex rounded-lg bg-gray-100 p-1">
        <button
          class="px-4 py-2 rounded-md transition-colors flex items-center gap-2"
          class:bg-white={pageMode === 'add'}
          class:shadow={pageMode === 'add'}
          onclick={() => pageMode = 'add'}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Add to your collection
        </button>
        <button
          class="px-4 py-2 rounded-md transition-colors flex items-center gap-2"
          class:bg-white={pageMode === 'search'}
          class:shadow={pageMode === 'search'}
          onclick={() => pageMode = 'search'}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Search your collection
        </button>
      </div>

      <!-- Wishlist Mode Toggle - always visible -->
      <button
        class="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        class:bg-yellow-100={mode === 'wishlist'}
        class:text-yellow-800={mode === 'wishlist'}
        class:bg-gray-100={mode === 'collection'}
        class:text-gray-700={mode === 'collection'}
        class:hover:bg-yellow-200={mode === 'wishlist'}
        class:hover:bg-gray-200={mode === 'collection'}
        onclick={() => mode = mode === 'collection' ? 'wishlist' : 'collection'}
      >
        <svg class="w-4 h-4" fill={mode === 'wishlist' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        Wishlist Mode
      </button>
    </div>

    {#if collectionOnly}
      <!-- Collection/Wishlist Header -->
      <div class="mb-2">
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
              <ShareButton />
            {:else}
              <WishlistImportButton />
              <WishlistExportButton />
              <ShareButton />
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Search Bar -->
    <div class="mb-1">
      <SearchBar onSearch={handleSearch} initialValue={searchQuery} />
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
          {mode === 'collection' ? 'Switch to "Add to your collection" to add cards' : 'Switch to "Add to your collection" to add cards to your wishlist'}
        </p>
      </div>
    {:else}
      <!-- Filter bar -->
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
        <CardGrid cards={displayedCards} {hasMore} onLoadMore={loadMore} />
      {/if}
    {/if}
  </div>
</div>

<!-- Filter Modal (mobile only) -->
{#if showFilterModal}
  <FilterModal
    activeFilters={activeFilters}
    onToggle={handleFilterToggle}
    onClose={() => showFilterModal = false}
  />
{/if}
