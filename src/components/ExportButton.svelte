<script lang="ts">
  import { collection, totalCards } from '../stores/collection';
  import { cardMap } from '../stores/cards';
  import { generateJSON, generateCSV, downloadFile, generateFilename } from '../utils/exportUtils';

  let isOpen = $state(false);

  function handleExportJSON() {
    try {
      const jsonContent = generateJSON($collection, $cardMap);
      const filename = generateFilename('json');
      downloadFile(jsonContent, filename, 'application/json');
      isOpen = false;
    } catch (error) {
      console.error('Failed to export JSON:', error);
      alert('Failed to export collection. Please try again.');
    }
  }

  function handleExportCSV() {
    try {
      const csvContent = generateCSV($collection, $cardMap);
      const filename = generateFilename('csv');
      downloadFile(csvContent, filename, 'text/csv');
      isOpen = false;
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Failed to export collection. Please try again.');
    }
  }

  function toggleDropdown() {
    isOpen = !isOpen;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.export-button-container')) {
      isOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

{#if $totalCards > 0}
  <div class="export-button-container">
    <div class="relative">
      <!-- Dropdown Menu (appears below button) -->
      {#if isOpen}
        <div class="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 animate-fade-in z-50">
          <button
            onclick={handleExportJSON}
            class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export as JSON
          </button>
          <button
            onclick={handleExportCSV}
            class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export as CSV
          </button>
        </div>
      {/if}

      <!-- Main Export Button -->
      <button
        onclick={toggleDropdown}
        class="flex items-center gap-2 px-5 py-3 bg-teal-600 text-white rounded-full shadow-lg hover:bg-teal-700 hover:shadow-xl transition-all duration-200 font-medium"
        title="Export your collection"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
      </button>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.15s ease-out;
  }
</style>
