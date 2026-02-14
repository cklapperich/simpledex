<script lang="ts">
  import { onMount } from 'svelte';

  let { onSearch, initialValue = '' }: { onSearch: (query: string) => void; initialValue?: string } = $props();

  let inputValue = $state('');
  let inputElement = $state<HTMLInputElement>();
  let lastInitialValue = $state('');
  let mounted = $state(false);

  // Sync inputValue with initialValue prop changes
  $effect(() => {
    if (initialValue !== lastInitialValue) {
      inputValue = initialValue;
      lastInitialValue = initialValue;
      if (mounted) {
        onSearch(initialValue);
      }
    }
  });

  onMount(() => {
    mounted = true;
    if (initialValue) {
      onSearch(initialValue);
    }
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      onSearch(inputValue);
    }
  }

  function clearSearch() {
    inputValue = '';
    onSearch('');
    inputElement?.focus();
  }
</script>

<div class="relative">
  <input
    bind:this={inputElement}
    bind:value={inputValue}
    onkeydown={handleKeyDown}
    type="text"
    placeholder="Search by name, set, or use filters like type:fire artist:arita has:rule_box"
    aria-label="Search cards"
    class="w-full px-6 py-4 text-lg rounded-xl border-2 border-gray-200
           focus:border-teal-600 focus:ring-2 focus:ring-teal-600 focus:outline-none
           shadow-lg transition-all duration-200"
  />

  {#if inputValue}
    <button
      onclick={clearSearch}
      class="absolute right-4 top-1/2 -translate-y-1/2
             text-gray-400 hover:text-gray-600 transition-colors"
      aria-label="Clear search"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  {/if}
</div>
