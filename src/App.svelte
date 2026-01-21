<script lang="ts">
  import Sidebar from './components/Sidebar.svelte';
  import CollectionPage from './components/CollectionPage.svelte';
  import SearchPage from './components/SearchPage.svelte';
  import { activeView } from './stores/view';
</script>

<div class="flex h-screen">
  <Sidebar />
  <main class="flex-1 overflow-y-auto">
    {#if $activeView === 'collection'}
      <CollectionPage />
    {:else}
      <SearchPage />
    {/if}
  </main>
</div>
