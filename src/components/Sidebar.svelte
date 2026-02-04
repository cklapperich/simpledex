<script lang="ts">
  import { activeView, type View } from '../stores/view';

  function navigateTo(view: View) {
    activeView.set(view);
  }
</script>

<aside class="w-16 bg-gray-800 text-white h-screen hidden lg:flex flex-col">
  <nav class="flex-1 p-2 pt-4">
    <button
      onclick={() => navigateTo('search')}
      class="w-full flex items-center justify-center px-3 py-3 rounded-lg mb-2 {$activeView === 'search'
        ? 'bg-blue-600 text-white'
        : 'text-gray-300 hover:bg-gray-700'}"
      title="Search"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>

    <button
      onclick={() => navigateTo('scan')}
      class="w-full flex items-center justify-center px-3 py-3 rounded-lg mb-2 {$activeView === 'scan'
        ? 'bg-blue-600 text-white'
        : 'text-gray-300 hover:bg-gray-700'}"
      title="Scan Card"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>

    <button
      onclick={() => navigateTo('decks')}
      class="w-full flex items-center justify-center px-3 py-3 rounded-lg mb-2 {$activeView === 'decks' || $activeView === 'deckbuilder'
        ? 'bg-blue-600 text-white'
        : 'text-gray-300 hover:bg-gray-700'}"
      title="Decks"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    </button>

    <button
      onclick={() => navigateTo('about')}
      class="w-full flex items-center justify-center px-3 py-3 rounded-lg {$activeView === 'about'
        ? 'bg-blue-600 text-white'
        : 'text-gray-300 hover:bg-gray-700'}"
      title="About"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  </nav>
</aside>
