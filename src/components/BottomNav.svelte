<script lang="ts">
  import { activeView, type View } from '../stores/view';

  function navigateTo(view: View) {
    activeView.set(view);
  }
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 pb-safe z-50 lg:hidden">
  <div class="flex justify-around items-center h-16">
    <!-- Search -->
    <button
      onclick={() => navigateTo('search')}
      class="flex flex-col items-center justify-center flex-1 h-full gap-1 {$activeView === 'search'
        ? 'text-blue-400'
        : 'text-gray-400 hover:text-gray-300'}"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span class="text-xs font-medium">Search</span>
    </button>

    <!-- Collection -->
    <button
      onclick={() => navigateTo('collection')}
      class="flex flex-col items-center justify-center flex-1 h-full gap-1 {$activeView === 'collection'
        ? 'text-blue-400'
        : 'text-gray-400 hover:text-gray-300'}"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <span class="text-xs font-medium">Collection</span>
    </button>

    <!-- Decks -->
    <button
      onclick={() => navigateTo('decks')}
      class="flex flex-col items-center justify-center flex-1 h-full gap-1 {$activeView === 'decks' || $activeView === 'deckbuilder'
        ? 'text-blue-400'
        : 'text-gray-400 hover:text-gray-300'}"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
      <span class="text-xs font-medium">Decks</span>
    </button>

    <!-- About -->
    <button
      onclick={() => navigateTo('about')}
      class="flex flex-col items-center justify-center flex-1 h-full gap-1 {$activeView === 'about'
        ? 'text-blue-400'
        : 'text-gray-400 hover:text-gray-300'}"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="text-xs font-medium">About</span>
    </button>
  </div>
</nav>
