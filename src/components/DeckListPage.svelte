<script lang="ts">
  import { decks } from '../stores/decks';
  import { activeView, activeDeckId } from '../stores/view';

  function createNewDeck() {
    const deckId = decks.createDeck('New Deck');
    activeDeckId.set(deckId);
    activeView.set('deckbuilder');
  }

  function openDeck(deckId: string) {
    activeDeckId.set(deckId);
    activeView.set('deckbuilder');
  }

  function deleteDeck(deckId: string, deckName: string) {
    if (confirm(`Delete deck "${deckName}"?`)) {
      decks.deleteDeck(deckId);
    }
  }

  function getTotalCards(deckCards: Record<string, number>): number {
    return Object.values(deckCards).reduce((sum, qty) => sum + qty, 0);
  }
</script>

<div class="p-6 max-w-6xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-3xl font-bold text-gray-800">My Decks</h1>
    <button
      onclick={createNewDeck}
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
    >
      + New Deck
    </button>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each Object.values($decks) as deck (deck.id)}
      <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div class="flex items-start justify-between mb-3">
          <h2 class="text-xl font-semibold text-gray-800 flex-1">{deck.name}</h2>
          <button
            onclick={() => deleteDeck(deck.id, deck.name)}
            class="text-red-500 hover:text-red-700 ml-2"
            aria-label="Delete deck"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        <div class="text-gray-600 mb-4">
          {getTotalCards(deck.cards)} cards
        </div>

        <button
          onclick={() => openDeck(deck.id)}
          class="w-full px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors"
        >
          Open Deck
        </button>
      </div>
    {/each}
  </div>

  {#if Object.keys($decks).length === 0}
    <div class="text-center py-16">
      <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <p class="text-gray-500 text-lg mb-4">No decks yet</p>
      <button
        onclick={createNewDeck}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        Create Your First Deck
      </button>
    </div>
  {/if}
</div>
