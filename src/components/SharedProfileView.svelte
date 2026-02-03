<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { Document } from 'flexsearch';
  import { setContext } from 'svelte';
  import type { Card } from '../types';
  import SearchBar from './SearchBar.svelte';
  import CardGrid from './CardGrid.svelte';
  import ModeToggle from './ModeToggle.svelte';
  import FilterColumn from './FilterColumn.svelte';
  import FilterModal from './FilterModal.svelte';
  import { allCards, cardMap, setMap, isLoading as cardsLoading } from '../stores/cards';
  import { isAuthenticated } from '../stores/auth';
  import { MODERN_SERIES } from '../constants';
  import { sortCardsBySetAndNumber } from '../utils/cardSorting';
  import { matchesFilters, saveFilters, loadFilters } from '../utils/cardFilters';
  import { resolveShareCode, loadUserCollection, loadUserWishlist } from '../utils/shareUtils';
  import { getCardName } from '../utils/cardUtils';
  import { activeView } from '../stores/view';

  interface Props {
    shareCode: string;
  }

  let { shareCode }: Props = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let sharedCollection = $state<Record<string, number>>({});
  let sharedWishlist = $state<Record<string, boolean>>({});
  let searchQuery = $state('');
  let modernOnly = $state(false);
  let indexReady = $state(false);
  let searchIndex: Document<Card>;
  let activeFilters = $state(new SvelteSet<string>());
  let showFilterModal = $state(false);
  let mode = $state<'collection' | 'wishlist'>('collection');

  // Set context so CardItem knows we're in read-only mode and which mode
  setContext('mode', () => mode);
  setContext('readOnly', true);
  // Set context for shared collection/wishlist data (avoids prop drilling through CardGrid)
  setContext('sharedCollection', () => sharedCollection);
  setContext('sharedWishlist', () => sharedWishlist);

  // Calculate totals
  const totalCollectionCards = $derived(
    Object.values(sharedCollection).reduce((sum, qty) => sum + qty, 0)
  );
  const totalWishlistCards = $derived(
    Object.keys(sharedWishlist).filter(id => sharedWishlist[id]).length
  );

  // Display cards based on current mode
  const displayedCards = $derived.by(() => {
    let cards: Card[] = [];

    // Get source data based on mode
    const sourceData = mode === 'collection' ? sharedCollection : sharedWishlist;

    // Build initial card list from source data
    for (const cardId in sourceData) {
      if (mode === 'collection' ? sourceData[cardId] > 0 : sourceData[cardId]) {
        const card = $cardMap.get(cardId);
        if (card) {
          cards.push(card);
        }
      }
    }

    // Apply search filter if query exists
    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();

      cards = cards.filter(card => {
        return (
          getCardName(card).toLowerCase().includes(queryLower) ||
          card.set.toLowerCase().includes(queryLower) ||
          card.setNumber.toLowerCase().includes(queryLower)
        );
      });
    }

    // Apply modern only filter
    if (modernOnly) {
      cards = cards.filter(card => MODERN_SERIES.includes(card.series));
    }

    // Apply active filters
    if (activeFilters.size > 0) {
      cards = cards.filter(card => matchesFilters(card, activeFilters));
    }

    // Sort by set name, then by number
    sortCardsBySetAndNumber(cards);

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

  // Load shared data on mount
  $effect(() => {
    async function loadSharedData() {
      loading = true;
      error = null;

      try {
        // Resolve share code to user_id
        const userId = await resolveShareCode(shareCode);

        if (!userId) {
          error = 'Profile not found';
          loading = false;
          return;
        }

        // Load both collection and wishlist in parallel
        const [collection, wishlist] = await Promise.all([
          loadUserCollection(userId),
          loadUserWishlist(userId)
        ]);

        if (collection === null || wishlist === null) {
          error = 'Failed to load profile data';
          loading = false;
          return;
        }

        sharedCollection = collection;
        sharedWishlist = wishlist;
        loading = false;
      } catch (err) {
        console.error('Error loading shared profile:', err);
        error = 'Failed to load profile';
        loading = false;
      }
    }

    loadSharedData();
  });

  // Build search index
  $effect(() => {
    if (!$cardsLoading && $allCards.length > 0) {
      searchIndex = new Document({
        document: {
          id: 'id',
          index: ['name']
        },
        tokenize: 'forward'
      });

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

  // Load filters from localStorage
  const filterKey = 'shared-profile-filters';
  $effect(() => {
    activeFilters = new SvelteSet<string>(loadFilters(filterKey));
  });

  // Save filters to localStorage
  $effect(() => {
    saveFilters(filterKey, activeFilters);
  });
</script>

<div class="min-h-screen bg-white">
  <div class="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4">
    {#if loading || $cardsLoading}
      <!-- Loading state -->
      <div class="flex items-center justify-center py-20">
        <div class="text-gray-600">Loading shared profile...</div>
      </div>
    {:else if error}
      <!-- Error state -->
      <div class="flex flex-col items-center justify-center py-20">
        <div class="text-gray-400 mb-4">
          <svg class="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="text-2xl font-semibold text-gray-900 mb-2">{error}</h2>
        <p class="text-gray-600 mb-4">The share link may be invalid or expired</p>
        <button
          onclick={() => activeView.set('search')}
          class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Go to Search
        </button>
      </div>
    {:else}
      <!-- Mode Toggle -->
      <div class="mb-4">
        <ModeToggle bind:mode />
      </div>

      <!-- Header with banner -->
      <div class="mb-2">
        {#if !$isAuthenticated}
          <div class="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span class="text-gray-900 font-medium">Want your own collection?</span>
              </div>
              <button
                onclick={() => activeView.set('search')}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Sign In
              </button>
            </div>
          </div>
        {/if}

        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-4xl font-bold text-gray-900 mb-2">
              Shared {mode === 'collection' ? 'Collection' : 'Wishlist'}
            </h1>
            <p class="text-gray-600">
              {#if mode === 'collection'}
                {#if totalCollectionCards > 0}
                  {totalCollectionCards} {totalCollectionCards === 1 ? 'card' : 'cards'}
                {:else}
                  No cards in collection
                {/if}
              {:else}
                {#if totalWishlistCards > 0}
                  {totalWishlistCards} {totalWishlistCards === 1 ? 'card' : 'cards'}
                {:else}
                  No cards on wishlist
                {/if}
              {/if}
            </p>
          </div>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="mb-1">
        <SearchBar onSearch={handleSearch} />
      </div>

      {#if (mode === 'collection' && totalCollectionCards === 0) || (mode === 'wishlist' && totalWishlistCards === 0)}
        <!-- Empty state -->
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
            {mode === 'collection' ? 'This collection is empty' : 'This wishlist is empty'}
          </h2>
          <p class="text-gray-600">
            {mode === 'collection' ? 'No cards have been added yet' : 'No cards on the wishlist yet'}
          </p>
        </div>
      {:else}
        <!-- Filter bar -->
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

        <div class="mb-2 hidden md:block">
          <FilterColumn activeFilters={activeFilters} onToggle={handleFilterToggle} />
        </div>
        <div class="border-t border-gray-300 mb-4"></div>

        <!-- Cards display -->
        {#if displayedCards.length === 0}
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
