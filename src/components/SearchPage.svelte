<script lang="ts">
  import { onMount } from 'svelte';
  import { Document } from 'flexsearch';
  import type { Card } from '../types';
  import SearchBar from './SearchBar.svelte';
  import CardGrid from './CardGrid.svelte';
  import ExportButton from './ExportButton.svelte';
  import ImportButton from './ImportButton.svelte';
  import FilterColumn from './FilterColumn.svelte';
  import { allCards, cardMap, setMap, isLoading as cardsLoading } from '../stores/cards';
  import { collection, totalCards } from '../stores/collection';

  interface Props {
    collectionOnly?: boolean;
  }

  let { collectionOnly = false }: Props = $props();

  let searchQuery = $state('');
  let modernOnly = $state(false);
  let indexReady = $state(false);
  let searchIndex: Document<Card>;
  let activeFilters = $state<Set<string>>(new Set());

  // Modern sets (Black & White onwards)
  const MODERN_SERIES = ['Black & White', 'XY', 'Sun & Moon', 'Sword & Shield', 'Scarlet & Violet', 'Mega Evolution'];

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
        let queryLower = query.toLowerCase();

        // Handle common set name aliases
        if (queryLower === 'base set') {
          queryLower = 'base';
        }

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
        let queryLower = query.toLowerCase();

        // Handle common set name aliases
        if (queryLower === 'base set') {
          queryLower = 'base';
        }

        // Check if query matches a set name exactly (case-insensitive) using pre-built index
        const setCards = $setMap.get(queryLower);
        if (setCards) {
          cards = [...setCards];
        } else {
          // Search pokemon names using FlexSearch
          const results = searchIndex.search(query, { field: 'name' });

          // FlexSearch returns results grouped by field, flatten and lookup cards
          const cardSet = new Set<string>();

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
      cards = cards.filter(matchesFilters);
    }

    // Sort logic
    if (collectionOnly) {
      // Collection mode: sort by set name, then by number
      cards.sort((a, b) => {
        // Handle undefined cards or properties
        if (!a || !b) return 0;
        if (!a.set || !b.set) return 0;

        const setCompare = a.set.localeCompare(b.set);
        if (setCompare !== 0) return setCompare;

        // Parse numbers for proper numeric sorting
        if (!a.number || !b.number) return 0;
        const aNum = parseInt(a.number);
        const bNum = parseInt(b.number);

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }

        // Fallback to string comparison for special numbers
        return a.number.localeCompare(b.number);
      });
    } else {
      // Search mode: sort by release date (newest first)
      cards.sort((a, b) => {
        if (!a || !b || !a.releaseDate || !b.releaseDate) return 0;
        return b.releaseDate.localeCompare(a.releaseDate);
      });
    }

    return cards;
  });

  // Search handler
  function handleSearch(query: string) {
    searchQuery = query;
  }

  // Filter toggle handler
  function handleFilterToggle(filter: string) {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      newFilters.add(filter);
    }
    activeFilters = newFilters;
  }

  // Check if card matches active filters
  function matchesFilters(card: Card): boolean {
    if (activeFilters.size === 0) return true;

    // Check each active filter
    for (const filter of activeFilters) {
      // Check if it's a type filter (Pokémon energy types)
      if (card.types && card.types.includes(filter)) {
        return true;
      }

      // Check if it's a category filter
      if (filter === 'Energy' && card.supertype === 'Energy') {
        return true;
      }

      // Check for Trainer supertype (matches all trainer cards)
      if (filter === 'Trainer' && card.supertype === 'Trainer') {
        return true;
      }

      // For Trainer subcategories (Item, Supporter, Tool)
      if (card.supertype === 'Trainer' && card.subtypes.includes(filter)) {
        return true;
      }
    }

    return false;
  }

  onMount(async () => {
    try {
      // Only load search index (cards loaded by store)
      const indexResponse = await fetch('/search-index.json');

      if (!indexResponse.ok) {
        throw new Error('Failed to load search index');
      }

      const exportedIndex = await indexResponse.json();

      // Create FlexSearch index and import pre-built data
      searchIndex = new Document({
        document: {
          id: 'id',
          index: [
            'name',           // Fuzzy matching for card names
            'set',            // Fuzzy matching for set names
            {
              field: 'number',
              tokenize: 'strict',  // Exact matching for numbers
              resolution: 9
            },
            {
              field: 'setNumber',
              tokenize: 'strict',  // Strict matching for "Set Number" searches
              resolution: 9
            }
          ]
        },
        tokenize: 'forward'  // Better partial matching for name/set
      });

      // Import the pre-built index
      for (const item of exportedIndex) {
        searchIndex.import(item.key, item.data);
      }
    } catch (error) {
      console.error('Error loading search index:', error);
    } finally {
      indexReady = true;
    }
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
