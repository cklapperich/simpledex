<script lang="ts">
  import { collection, totalCards } from '../stores/collection';
  import { cardMap } from '../stores/cards';
  import { parseCSV, validateImport } from '../utils/importUtils';
  import type { Collection, ImportResult } from '../types';

  let fileInput: HTMLInputElement;
  let showWarningModal = $state(false);
  let showResultModal = $state(false);
  let pendingCollection: Collection | null = $state(null);
  let importResult: ImportResult | null = $state(null);
  let showDetailedErrors = $state(false);

  function handleImportClick() {
    fileInput.click();
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parseResult = parseCSV(content);

      // Check for parsing errors
      if (parseResult.result) {
        importResult = parseResult.result;
        showResultModal = true;
        target.value = ''; // Reset file input
        return;
      }

      // Validate against card database
      const validationResult = validateImport(parseResult.collection!, $cardMap, parseResult.cardNames);

      if (!validationResult.success) {
        importResult = validationResult;
        showResultModal = true;
        target.value = ''; // Reset file input
        return;
      }

      // Store validated collection
      pendingCollection = parseResult.collection!;
      importResult = validationResult;

      // Show warning if collection is not empty
      if ($totalCards > 0) {
        showWarningModal = true;
      } else {
        // Import directly if collection is empty
        confirmImport();
      }

      target.value = ''; // Reset file input
    } catch (error) {
      console.error('Failed to read file:', error);
      importResult = {
        success: false,
        imported: 0,
        skipped: 0,
        errors: ['Failed to read file. Please try again.']
      };
      showResultModal = true;
      target.value = ''; // Reset file input
    }
  }

  function confirmImport() {
    if (pendingCollection) {
      collection.importCollection(pendingCollection);
      showWarningModal = false;
      showResultModal = true;
      pendingCollection = null;
    }
  }

  function cancelImport() {
    showWarningModal = false;
    pendingCollection = null;
    importResult = null;
  }

  function closeResultModal() {
    showResultModal = false;
    importResult = null;
    showDetailedErrors = false;
  }

  function getUniqueCount(coll: Collection): number {
    return Object.keys(coll).length;
  }
</script>

<button
  onclick={handleImportClick}
  class="flex items-center gap-2 px-5 py-3 bg-teal-600 text-white rounded-full shadow-lg hover:bg-teal-700 hover:shadow-xl transition-all duration-200 font-medium"
  title="Import collection from CSV"
>
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
  Import
</button>

<input
  type="file"
  accept=".csv"
  bind:this={fileInput}
  onchange={handleFileSelect}
  class="hidden"
/>

<!-- Warning Modal -->
{#if showWarningModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick={cancelImport}>
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-start gap-3 mb-4">
        <div class="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
          <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Replace Current Collection?</h3>
          <p class="text-gray-600 mb-4">
            Import will replace your current collection. You currently have <strong>{$totalCards} cards</strong> in <strong>{getUniqueCount($collection)} unique cards</strong>.
          </p>
          {#if importResult}
            <p class="text-sm text-gray-500 mb-4">
              The import will add <strong>{importResult.imported} unique cards</strong>.
              {#if importResult.skipped > 0}
                <span class="text-yellow-600">{importResult.skipped} card(s) will be skipped.</span>
              {/if}
            </p>
          {/if}
        </div>
      </div>
      <div class="flex gap-3 justify-end">
        <button
          onclick={cancelImport}
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          onclick={confirmImport}
          class="px-4 py-2 text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors font-medium"
        >
          Replace Collection
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Result Modal -->
{#if showResultModal && importResult}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick={closeResultModal}>
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-start gap-3 mb-4">
        {#if importResult.success}
          <div class="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Import Successful</h3>
            <p class="text-gray-600 mb-2">
              Successfully imported <strong>{importResult.imported} unique cards</strong>.
            </p>
            {#if importResult.skipped > 0}
              <p class="text-sm text-yellow-600 mb-2">
                Skipped {importResult.skipped} invalid card(s).
              </p>
              {#if importResult.detailedErrors && importResult.detailedErrors.length > 0}
                <button
                  onclick={() => showDetailedErrors = !showDetailedErrors}
                  class="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                >
                  <svg class="w-4 h-4 transition-transform" class:rotate-90={showDetailedErrors} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  {showDetailedErrors ? 'Hide' : 'Show'} details
                </button>
              {/if}
            {/if}
          </div>
        {:else}
          <div class="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Import Failed</h3>
            {#if importResult.errors.length > 0}
              <div class="text-sm text-gray-600 space-y-1 mb-2">
                {#each importResult.errors as error}
                  <p>{error}</p>
                {/each}
              </div>
              {#if importResult.detailedErrors && importResult.detailedErrors.length > 0}
                <button
                  onclick={() => showDetailedErrors = !showDetailedErrors}
                  class="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                >
                  <svg class="w-4 h-4 transition-transform" class:rotate-90={showDetailedErrors} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  {showDetailedErrors ? 'Hide' : 'Show'} details
                </button>
              {/if}
            {/if}
          </div>
        {/if}
      </div>

      <!-- Detailed Errors Section -->
      {#if showDetailedErrors && importResult.detailedErrors && importResult.detailedErrors.length > 0}
        <div class="mt-4 border-t border-gray-200 pt-4">
          <h4 class="text-sm font-semibold text-gray-900 mb-2">Detailed Error Log</h4>
          <div class="max-h-60 overflow-y-auto bg-gray-50 rounded-lg p-3 text-xs font-mono">
            {#each importResult.detailedErrors as error, index}
              <div class="mb-2 pb-2 border-b border-gray-200 last:border-0 last:mb-0 last:pb-0">
                <div class="flex items-start gap-2">
                  <span class="text-gray-500">#{index + 1}</span>
                  <div class="flex-1">
                    {#if error.cardName}
                      <div class="font-semibold text-gray-900">{error.cardName}</div>
                    {/if}
                    {#if error.cardId}
                      <div class="text-gray-600">ID: {error.cardId}</div>
                    {/if}
                    {#if error.line}
                      <div class="text-gray-500">Line: {error.line}</div>
                    {/if}
                    <div class="text-red-600 mt-1">{error.message}</div>
                    <div class="text-gray-400 text-xs mt-1">Type: {error.type}</div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="flex justify-end mt-4">
        <button
          onclick={closeResultModal}
          class="px-4 py-2 text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors font-medium"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
