<script lang="ts">
  import Sidebar from './components/Sidebar.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import CollectionPage from './components/CollectionPage.svelte';
  import SearchPage from './components/SearchPage.svelte';
  import About from './components/About.svelte';
  import DeckListPage from './components/DeckListPage.svelte';
  import DeckBuilderPage from './components/DeckBuilderPage.svelte';
  import SyncIndicator from './components/SyncIndicator.svelte';
  import { Toaster } from 'svelte-sonner';
  import { activeView } from './stores/view';
</script>

<div class="flex h-screen">
  <Sidebar />
  <main class="flex-1 overflow-y-auto pb-16 lg:pb-0">
    <div class="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3">
      <SyncIndicator />
    </div>
    {#if $activeView === 'collection'}
      <CollectionPage />
    {:else if $activeView === 'decks'}
      <DeckListPage />
    {:else if $activeView === 'deckbuilder'}
      <DeckBuilderPage />
    {:else if $activeView === 'about'}
      <About />
    {:else}
      <SearchPage />
    {/if}
  </main>
  <BottomNav />
  <Toaster position="top-right" />
</div>
