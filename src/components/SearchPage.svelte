<script lang="ts">
  import { onMount } from 'svelte';
  import { Document } from 'flexsearch';
  import type { Card } from '../types';
  import SearchBar from './SearchBar.svelte';
  import CardGrid from './CardGrid.svelte';

  let allCards = $state<Card[]>([]);
  let cardMap = $state<Map<string, Card>>(new Map());
  let setMap = $state<Map<string, Card[]>>(new Map()); // Maps lowercase set name -> cards
  let searchQuery = $state('');
  let isLoading = $state(true);
  let searchIndex: Document<Card>;

  // Display cards: first 50 if no search, all matching if searching
  const displayedCards = $derived.by(() => {
    if (!searchQuery.trim()) {
      // No search - show only first 50 cards
      return allCards.slice(0, 50);
    }

    const query = searchQuery.trim();
    const queryLower = query.toLowerCase();

    // Check if query matches a set name exactly (case-insensitive) using pre-built index
    const setCards = setMap.get(queryLower);
    if (setCards) {
      return setCards;
    }

    // Search pokemon names using FlexSearch
    const results = searchIndex.search(query, { field: 'name' });

    // FlexSearch returns results grouped by field, flatten and lookup cards
    const cardSet = new Set<string>();
    const cards: Card[] = [];

    for (const fieldResult of results) {
      for (const cardId of fieldResult.result) {
        if (!cardSet.has(cardId)) {
          cardSet.add(cardId);
          const card = cardMap.get(cardId);
          if (card) {
            cards.push(card);
          }
        }
      }
    }

    return cards;
  });

  // Search handler
  function handleSearch(query: string) {
    searchQuery = query;
  }

  onMount(async () => {
    try {
      // Load cards and index in parallel
      const [cardsResponse, indexResponse] = await Promise.all([
        fetch('/cards.json'),
        fetch('/search-index.json')
      ]);

      if (!cardsResponse.ok || !indexResponse.ok) {
        throw new Error('Failed to load data');
      }

      allCards = await cardsResponse.json();
      const exportedIndex = await indexResponse.json();

      // Build card map for quick lookups
      cardMap = new Map(allCards.map(card => [card.id, card]));

      // Build set map for instant set lookups
      const setGroups = new Map<string, Card[]>();
      for (const card of allCards) {
        const setKey = card.set.toLowerCase();
        if (!setGroups.has(setKey)) {
          setGroups.set(setKey, []);
        }
        setGroups.get(setKey)!.push(card);
      }
      setMap = setGroups;

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
      console.error('Error loading cards:', error);
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="min-h-screen bg-white">
  <div class="max-w-7xl mx-auto px-8 py-12">
    <!-- Search Bar -->
    <div class="mb-8">
      <SearchBar onSearch={handleSearch} />
    </div>

    <!-- Loading state -->
    {#if isLoading}
      <div class="flex items-center justify-center py-20">
        <div class="text-gray-600">Loading cards...</div>
      </div>
    {:else}
      <CardGrid cards={displayedCards} />
    {/if}
  </div>
</div>
