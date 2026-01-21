<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { Document } from 'flexsearch';
  import type { Card } from '../types';
  import SearchBar from './SearchBar.svelte';
  import CardItem from './CardItem.svelte';
  import FilterColumn from './FilterColumn.svelte';
  import DeckCardList from './DeckCardList.svelte';
  import { allCards, cardMap, setMap, isLoading as cardsLoading } from '../stores/cards';
  import { collection } from '../stores/collection';
  import { decks } from '../stores/decks';
  import { activeDeckId, activeView } from '../stores/view';
  import { exportToPTCGO, importFromPTCGO, validateDeck } from '../utils/deckUtils';
  import { MODERN_SERIES } from '../constants';
  import { sortCardsBySetAndNumber } from '../utils/cardSorting';
  import { matchesFilters, normalizeSetName } from '../utils/cardFilters';

  let searchQuery = $state('');
  let modernOnly = $state(false);
  let searchIndex: Document<Card>;
  let activeFilters = $state(new SvelteSet<string>());
  let editingName = $state(false);
  let tempName = $state('');
  let importText = $state('');
  let showImportModal = $state(false);

  const currentDeck = $derived($activeDeckId ? $decks[$activeDeckId] : null);
  const validation = $derived(currentDeck ? validateDeck(currentDeck, $cardMap) : { isValid: true, cardCount: 0, warnings: [] });

  // Filter collection cards for display
  const displayedCards = $derived.by(() => {
    let cards: Card[] = [];

    // Start with all cards in collection
    const collectionData = $collection;
    for (const cardId in collectionData) {
      if (collectionData[cardId] > 0) {
        const card = $cardMap.get(cardId);
        if (card) {
          cards.push(card);
        }
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      const queryLower = normalizeSetName(query);

      cards = cards.filter(card => {
        return (
          card.name.toLowerCase().includes(queryLower) ||
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

  function handleSearch(query: string) {
    searchQuery = query;
  }

  function handleFilterToggle(filter: string) {
    const newFilters = new SvelteSet(activeFilters);
    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      newFilters.add(filter);
    }
    activeFilters = newFilters;
  }

  function handleCardClick(cardId: string) {
    if (currentDeck) {
      decks.addCardToDeck(currentDeck.id, cardId);
    }
  }

  function handleRemoveCard(cardId: string) {
    if (currentDeck) {
      decks.removeCardFromDeck(currentDeck.id, cardId);
    }
  }

  function startEditingName() {
    if (currentDeck) {
      tempName = currentDeck.name;
      editingName = true;
    }
  }

  function saveName() {
    if (currentDeck && tempName.trim()) {
      decks.renameDeck(currentDeck.id, tempName.trim());
    }
    editingName = false;
  }

  function cancelEdit() {
    editingName = false;
    tempName = '';
  }

  function handleExport() {
    if (currentDeck) {
      const ptcgoText = exportToPTCGO(currentDeck, $cardMap);
      navigator.clipboard.writeText(ptcgoText).then(() => {
        alert('Deck exported to clipboard!');
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
      });
    }
  }

  function handleImport() {
    showImportModal = true;
    importText = '';
  }

  function doImport() {
    if (currentDeck && importText.trim()) {
      const importedCards = importFromPTCGO(importText, $cardMap);

      // Replace deck cards with imported cards
      for (const [cardId, quantity] of Object.entries(importedCards)) {
        decks.setCardQuantity(currentDeck.id, cardId, quantity);
      }

      showImportModal = false;
      importText = '';
      alert('Deck imported successfully!');
    }
  }

  function closeImportModal() {
    showImportModal = false;
    importText = '';
  }

  function goBackToDecks() {
    activeDeckId.set(null);
    activeView.set('decks');
  }

  onMount(async () => {
    try {
      const indexResponse = await fetch('/search-index.json');
      if (!indexResponse.ok) {
        throw new Error('Failed to load search index');
      }

      const exportedIndex = await indexResponse.json();

      searchIndex = new Document({
        document: {
          id: 'id',
          index: [
            'name',
            'set',
            {
              field: 'number',
              tokenize: 'strict',
              resolution: 9
            },
            {
              field: 'setNumber',
              tokenize: 'strict',
              resolution: 9
            }
          ]
        },
        tokenize: 'forward'
      });

      for (const item of exportedIndex) {
        searchIndex.import(item.key, item.data);
      }
    } catch (error) {
      console.error('Error loading search index:', error);
    }
  });
</script>

{#if !currentDeck}
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <p class="text-gray-600 mb-4">Deck not found</p>
      <button
        onclick={goBackToDecks}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
      >
        Back to Decks
      </button>
    </div>
  </div>
{:else}
  <div class="flex h-screen">
    <!-- Left Side: Card Browser -->
    <div class="flex-1 overflow-y-auto bg-white">
      <div class="max-w-6xl mx-auto px-6 py-4">
        <!-- Header -->
        <div class="mb-4">
          <button
            onclick={goBackToDecks}
            class="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
          >
            ← Back to Decks
          </button>

          {#if editingName}
            <div class="flex items-center gap-2">
              <input
                type="text"
                bind:value={tempName}
                class="text-3xl font-bold border-b-2 border-blue-600 focus:outline-none"
                onkeydown={(e) => e.key === 'Enter' && saveName()}
              />
              <button
                onclick={saveName}
                class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
              >
                Save
              </button>
              <button
                onclick={cancelEdit}
                class="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded text-sm"
              >
                Cancel
              </button>
            </div>
          {:else}
            <button
              type="button"
              onclick={startEditingName}
              class="text-3xl font-bold text-gray-900 hover:text-blue-600 text-left"
            >
              {currentDeck.name}
            </button>
          {/if}
          <p class="text-gray-600 text-sm mt-1">Click cards from your collection to add to deck</p>
        </div>

        <!-- Search Bar -->
        <div class="mb-2">
          <SearchBar onSearch={handleSearch} />

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

        <!-- Filter Column -->
        <div class="mb-2">
          <FilterColumn activeFilters={activeFilters} onToggle={handleFilterToggle} />
        </div>
        <div class="border-t border-gray-300 mb-4"></div>

        <!-- Cards Grid -->
        {#if $cardsLoading}
          <div class="flex items-center justify-center py-20">
            <div class="text-gray-600">Loading cards...</div>
          </div>
        {:else if displayedCards.length === 0}
          <div class="flex flex-col items-center justify-center py-20">
            <div class="text-gray-400 text-6xl mb-4">🔍</div>
            <h2 class="text-2xl font-semibold text-gray-900 mb-2">No cards found</h2>
            <p class="text-gray-600">Try adjusting your search or add cards to your collection</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {#each displayedCards as card (card.id)}
              <button
                type="button"
                class="cursor-pointer hover:opacity-70 transition-opacity"
                onclick={() => handleCardClick(card.id)}
              >
                <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                  <img
                    src={card.image}
                    alt={card.name}
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Right Side: Deck List -->
    <div class="w-96 bg-gray-50 border-l border-gray-300 overflow-y-auto">
      <div class="p-4">
        <!-- Deck Stats -->
        <div class="mb-4">
          <div class="text-2xl font-bold text-gray-900">{validation.cardCount} / 60</div>
          <div class="text-sm text-gray-600">cards in deck</div>
        </div>

        <!-- Validation Warnings -->
        {#if validation.warnings.length > 0}
          <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div class="text-sm font-semibold text-yellow-800 mb-1">Warnings:</div>
            {#each validation.warnings as warning, index (index)}
              <div class="text-xs text-yellow-700">• {warning}</div>
            {/each}
          </div>
        {/if}

        <!-- Export/Import Buttons -->
        <div class="flex gap-2 mb-4">
          <button
            onclick={handleExport}
            class="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Export
          </button>
          <button
            onclick={handleImport}
            class="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Import
          </button>
        </div>

        <div class="border-t border-gray-300 mb-4"></div>

        <!-- Deck Card List -->
        <DeckCardList deckCards={currentDeck.cards} onRemoveCard={handleRemoveCard} />
      </div>
    </div>
  </div>
{/if}

<!-- Import Modal -->
{#if showImportModal}
  <div
    role="presentation"
    tabindex="-1"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    onclick={closeImportModal}
    onkeydown={(e) => e.key === 'Escape' && closeImportModal()}
  >
    <div
      role="dialog"
      aria-labelledby="import-modal-title"
      tabindex="-1"
      class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h2 id="import-modal-title" class="text-2xl font-bold mb-4">Import Deck (PTCGO Format)</h2>
      <p class="text-sm text-gray-600 mb-3">Paste your PTCGO deck list below:</p>
      <textarea
        bind:value={importText}
        class="w-full h-64 border border-gray-300 rounded-lg p-3 font-mono text-sm"
        placeholder="* 1 Mimikyu TEU 112&#10;* 1 Sylveon CEC 155&#10;* 1 Eevee CEC 166"
      ></textarea>
      <div class="flex gap-3 mt-4">
        <button
          onclick={doImport}
          class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          Import
        </button>
        <button
          onclick={closeImportModal}
          class="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
