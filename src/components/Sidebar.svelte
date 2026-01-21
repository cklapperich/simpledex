<script lang="ts">
  import { activeView, type View } from '../stores/view';

  function navigateTo(view: View) {
    activeView.set(view);
  }
</script>

<aside class="w-16 bg-gray-800 text-white h-screen flex flex-col">
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
      onclick={() => navigateTo('collection')}
      class="w-full flex items-center justify-center px-3 py-3 rounded-lg {$activeView === 'collection'
        ? 'bg-blue-600 text-white'
        : 'text-gray-300 hover:bg-gray-700'}"
      title="Collection"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    </button>
  </nav>
</aside>
