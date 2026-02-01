<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import type { Card } from '../types';
  import SearchBar from './SearchBar.svelte';
  import CardItem from './CardItem.svelte';
  import FilterColumn from './FilterColumn.svelte';
  import FilterModal from './FilterModal.svelte';
  import DeckCardList from './DeckCardList.svelte';
  import FullDeckView from './FullDeckView.svelte';
  import { allCards, cardMap, setMap, isLoading as cardsLoading } from '../stores/cards';
  import { collection } from '../stores/collection';
  import { decks } from '../stores/decks';
  import { activeDeckId, activeView } from '../stores/view';
  import { glcMode } from '../stores/glcMode';
  import { exportToPTCGO, importFromPTCGO, validateDeck, validateGLCAddition, validateDeckGLC } from '../utils/deckUtils';
  import { MODERN_SERIES } from '../constants';
  import { sortCardsBySetAndNumber } from '../utils/cardSorting';
  import { matchesFilters, normalizeSetName, saveFilters, loadFilters } from '../utils/cardFilters';
  import { getCardImageUrl } from '../utils/cardImage';

  // Helper to get card name
  function getCardName(card: Card): string {
    return card.names['en'] || card.names[Object.keys(card.names)[0]] || 'Unknown';
  }

  let searchQuery = $state('');
  let modernOnly = $state(false);
  let activeFilters = $state(new SvelteSet<string>(loadFilters('deck-builder-filters')));
  let editingName = $state(false);
  let tempName = $state('');
  let importText = $state('');
  let showImportModal = $state(false);
  let showFilterModal = $state(false);
  let mobileView = $state<'browse' | 'deck'>('browse');
  let leftPanelTab = $state<'browse' | 'fullDeck'>('browse');
  let glcWarning = $state<string | null>(null);

  const currentDeck = $derived($activeDeckId ? $decks[$activeDeckId] : null);
  const validation = $derived(currentDeck ? validateDeck(currentDeck, $cardMap) : { isValid: true, cardCount: 0, warnings: [] });
  const glcValidation = $derived(currentDeck && $glcMode ? validateDeckGLC(currentDeck, $cardMap) : []);
  const totalDeckCards = $derived(currentDeck ? Object.values(currentDeck.cards).reduce((sum, qty) => sum + qty, 0) : 0);

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
        const cardName = getCardName(card).toLowerCase();
        return (
          cardName.includes(queryLower) ||
          card.set.toLowerCase().includes(queryLower) ||
          (card.setNumber || '').toLowerCase().includes(queryLower)
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
      const collectionQty = $collection[cardId] || 0;
      const deckQty = currentDeck.cards[cardId] || 0;
      const available = collectionQty - deckQty;
      if (available > 0) {
        // Check GLC rules if GLC mode is enabled
        if ($glcMode) {
          const card = $cardMap.get(cardId);
          if (card) {
            const glcResult = validateGLCAddition(card, currentDeck.cards, $cardMap);
            if (!glcResult.canAdd) {
              glcWarning = glcResult.reason || 'Card cannot be added under GLC rules';
              setTimeout(() => { glcWarning = null; }, 3000);
              return;
            }
          }
        }
        decks.addCardToDeck(currentDeck.id, cardId);
      }
    }
  }

  function handleAddCard(cardId: string) {
    // For adding cards from the deck list (e.g., in sidebar or full deck view)
    // This doesn't check collection availability since we're adding more of what's in deck
    if (currentDeck) {
      const collectionQty = $collection[cardId] || 0;
      const deckQty = currentDeck.cards[cardId] || 0;
      const available = collectionQty - deckQty;
      if (available > 0) {
        // Check GLC rules if GLC mode is enabled
        if ($glcMode) {
          const card = $cardMap.get(cardId);
          if (card) {
            const glcResult = validateGLCAddition(card, currentDeck.cards, $cardMap);
            if (!glcResult.canAdd) {
              glcWarning = glcResult.reason || 'Card cannot be added under GLC rules';
              setTimeout(() => { glcWarning = null; }, 3000);
              return;
            }
          }
        }
        decks.addCardToDeck(currentDeck.id, cardId);
      }
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

  function showDeckView() {
    mobileView = 'deck';
  }

  function showBrowseView() {
    mobileView = 'browse';
  }

// Save filters to localStorage whenever they change
  $effect(() => {
    saveFilters('deck-builder-filters', activeFilters);
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
    <div class="w-full lg:flex-1 overflow-y-auto bg-white pb-24 lg:pb-4 {mobileView === 'deck' ? 'hidden lg:block' : ''}">
      <div class="max-w-6xl mx-auto px-4 md:px-6 py-4">
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
                class="text-xl md:text-2xl lg:text-3xl font-bold border-b-2 border-blue-600 focus:outline-none"
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
              class="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 hover:text-blue-600 text-left"
            >
              {currentDeck.name}
            </button>
          {/if}
          <p class="text-gray-600 text-sm mt-1">Click cards from your collection to add to deck</p>
        </div>

        <!-- Tab Buttons -->
        <div class="flex gap-2 mb-4">
          <button
            onclick={() => leftPanelTab = 'browse'}
            class="px-4 py-2 rounded-lg font-medium transition-colors {leftPanelTab === 'browse' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
          >
            Browse Cards
          </button>
          <button
            onclick={() => leftPanelTab = 'fullDeck'}
            class="px-4 py-2 rounded-lg font-medium transition-colors {leftPanelTab === 'fullDeck' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
          >
            Full Deck View
          </button>
        </div>

        <!-- GLC Warning Toast -->
        {#if glcWarning}
          <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {glcWarning}
          </div>
        {/if}

        {#if leftPanelTab === 'browse'}
          <!-- Search Bar -->
          <div class="mb-2">
            <SearchBar onSearch={handleSearch} />

            <div class="mt-2 flex flex-wrap gap-4">
              <label class="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={modernOnly}
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="ml-2 text-sm text-gray-700">Modern Only (Black & White onwards)</span>
              </label>
              <label class="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={$glcMode}
                  onchange={() => glcMode.toggle()}
                  class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span class="ml-2 text-sm text-gray-700">GLC Mode (1 copy per card name)</span>
              </label>
            </div>
          </div>

          <!-- Filters -->
          <!-- Mobile: Filter button -->
          <div class="lg:hidden mb-2">
            <button
              onclick={() => showFilterModal = true}
              class="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg flex items-center justify-between text-gray-700 font-medium"
            >
              <span>Filters</span>
              {#if activeFilters.size > 0}
                <span class="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">{activeFilters.size}</span>
              {/if}
            </button>
          </div>

          <!-- Desktop: Filter Column -->
          <div class="hidden lg:block mb-2">
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
                {@const deckQuantity = currentDeck.cards[card.id] || 0}
                {@const collectionQuantity = $collection[card.id] || 0}
                {@const availableQuantity = collectionQuantity - deckQuantity}
                <div
                  role="button"
                  tabindex="0"
                  class="relative cursor-pointer hover:opacity-70 transition-opacity"
                  onclick={() => handleCardClick(card.id)}
                  onkeydown={(e) => e.key === 'Enter' && handleCardClick(card.id)}
                >
                  <div class="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                    <img
                      src={getCardImageUrl(card, 'en')}
                      alt={getCardName(card)}
                      loading="lazy"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <!-- Collection Quantity & Deck Controls Overlay -->
                  <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {#if deckQuantity > 0}
                      <div class="flex items-center gap-3 pointer-events-auto">
                        <button
                          type="button"
                          class="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-xl flex items-center justify-center transition-colors shadow-xl"
                          onclick={(e) => { e.stopPropagation(); handleRemoveCard(card.id); }}
                          aria-label="Remove from deck"
                        >
                          −
                        </button>
                        <span class="min-w-[2.5rem] text-center font-bold text-2xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                          {availableQuantity}
                        </span>
                        <button
                          type="button"
                          class="w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold text-xl flex items-center justify-center transition-colors shadow-xl {availableQuantity <= 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                          onclick={(e) => { e.stopPropagation(); handleCardClick(card.id); }}
                          aria-label="Add to deck"
                          disabled={availableQuantity <= 0}
                        >
                          +
                        </button>
                      </div>
                    {:else}
                      <span class="min-w-[2.5rem] text-center font-bold text-2xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {availableQuantity}
                      </span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          <!-- Full Deck View -->
          <FullDeckView
            deckCards={currentDeck.cards}
            onAddCard={handleAddCard}
            onRemoveCard={handleRemoveCard}
          />
        {/if}
      </div>

      <!-- Floating "View Deck" Button (Mobile Only) -->
      <button
        onclick={showDeckView}
        class="fixed bottom-20 left-1/2 -translate-x-1/2 lg:hidden bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 z-40 transition-all"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        <span class="font-medium">View Deck ({totalDeckCards})</span>
        {#if !validation.isValid}
          <svg class="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        {/if}
      </button>
    </div>

    <!-- Right Side: Deck List -->
    <div class="w-full lg:w-96 bg-gray-50 lg:border-l border-gray-300 overflow-y-auto {mobileView === 'browse' ? 'hidden lg:block' : ''}">
      <!-- Back to Cards Button (Mobile Only) -->
      <button
        onclick={showBrowseView}
        class="lg:hidden w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 flex items-center gap-2 text-gray-700 font-medium border-b border-gray-300"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Cards
      </button>

      <div class="p-4 lg:p-6">
        <!-- Deck Stats -->
        <div class="mb-4">
          <div class="text-2xl font-bold text-gray-900">{validation.cardCount} / 60</div>
          <div class="text-sm text-gray-600">cards in deck</div>
        </div>

        <!-- GLC Mode Toggle -->
        <div class="mb-4">
          <label class="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={$glcMode}
              onchange={() => glcMode.toggle()}
              class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <span class="ml-2 text-sm text-gray-700">GLC Mode</span>
          </label>
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

        <!-- GLC Validation Warnings -->
        {#if $glcMode && glcValidation.length > 0}
          <div class="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div class="text-sm font-semibold text-purple-800 mb-1">GLC Violations:</div>
            {#each glcValidation as violation, index (index)}
              <div class="text-xs text-purple-700">• {violation}</div>
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
        <DeckCardList deckCards={currentDeck.cards} onRemoveCard={handleRemoveCard} onAddCard={handleAddCard} />
      </div>
    </div>
  </div>
{/if}

<!-- Filter Modal (Mobile) -->
{#if showFilterModal}
  <FilterModal
    activeFilters={activeFilters}
    onToggle={handleFilterToggle}
    onClose={() => showFilterModal = false}
  />
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
