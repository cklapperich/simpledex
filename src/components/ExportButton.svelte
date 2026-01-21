<script lang="ts">
  import { collection, totalCards } from '../stores/collection';
  import { cardMap } from '../stores/cards';
  import { generateCSV, downloadFile, generateFilename } from '../utils/exportUtils';

  function handleExport() {
    try {
      const csvContent = generateCSV($collection, $cardMap);
      const filename = generateFilename('csv');
      downloadFile(csvContent, filename, 'text/csv');
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Failed to export collection. Please try again.');
    }
  }
</script>

{#if $totalCards > 0}
  <button
    onclick={handleExport}
    class="flex items-center gap-2 px-5 py-3 bg-teal-600 text-white rounded-full shadow-lg hover:bg-teal-700 hover:shadow-xl transition-all duration-200 font-medium"
    title="Export your collection as CSV"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
    Export
  </button>
{/if}
