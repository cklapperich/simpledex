<script lang="ts">
  import { wishlist, totalWishlisted } from '../stores/wishlist';
  import { cardMap } from '../stores/cards';
  import type { Wishlist, ImportResult } from '../types';
  import Modal from './Modal.svelte';

  let fileInput: HTMLInputElement;
  let showWarningModal = $state(false);
  let showResultModal = $state(false);
  let pendingWishlist: Wishlist | null = $state(null);
  let importResult: ImportResult | null = $state(null);

  function handleImportClick() {
    fileInput.click();
  }

  function parseWishlistCSV(content: string): { wishlist?: Wishlist; result?: ImportResult } {
    const lines = content.trim().split('\n');

    if (lines.length === 0) {
      return {
        result: {
          success: false,
          imported: 0,
          skipped: 0,
          errors: ['File is empty']
        }
      };
    }

    const newWishlist: Wishlist = {};
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    // Skip header if present
    const startIdx = lines[0].toLowerCase().includes('card') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handle quoted fields)
      const fields: string[] = [];
      let currentField = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim());

      // First field should be card ID
      const cardId = fields[0]?.replace(/^"|"$/g, '').trim();

      if (!cardId) {
        skipped++;
        continue;
      }

      // Validate card exists
      if (!$cardMap.has(cardId)) {
        errors.push(`Line ${i + 1}: Card ID "${cardId}" not found`);
        skipped++;
        continue;
      }

      newWishlist[cardId] = true;
      imported++;
    }

    return {
      wishlist: newWishlist,
      result: {
        success: true,
        imported,
        skipped,
        errors
      }
    };
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parseResult = parseWishlistCSV(content);

      if (!parseResult.wishlist || (parseResult.result && !parseResult.result.success)) {
        importResult = parseResult.result || {
          success: false,
          imported: 0,
          skipped: 0,
          errors: ['Failed to parse wishlist']
        };
        showResultModal = true;
        target.value = '';
        return;
      }

      pendingWishlist = parseResult.wishlist;
      importResult = parseResult.result || { success: true, imported: 0, skipped: 0, errors: [] };

      // Show warning if wishlist is not empty
      if ($totalWishlisted > 0) {
        showWarningModal = true;
      } else {
        // Import directly if wishlist is empty
        confirmImport();
      }

      target.value = '';
    } catch (error) {
      console.error('Failed to read file:', error);
      importResult = {
        success: false,
        imported: 0,
        skipped: 0,
        errors: ['Failed to read file. Please try again.']
      };
      showResultModal = true;
      target.value = '';
    }
  }

  function confirmImport() {
    if (pendingWishlist) {
      wishlist.importWishlist(pendingWishlist);
      showWarningModal = false;
      showResultModal = true;
      pendingWishlist = null;
    }
  }

  function cancelImport() {
    showWarningModal = false;
    pendingWishlist = null;
    importResult = null;
  }

  function closeResultModal() {
    showResultModal = false;
    importResult = null;
  }
</script>

<button
  onclick={handleImportClick}
  class="flex items-center gap-2 px-5 py-3 bg-yellow-500 text-white rounded-full shadow-lg hover:bg-yellow-600 hover:shadow-xl transition-all duration-200 font-medium"
  title="Import wishlist from CSV"
>
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
  Import Wishlist
</button>

<input
  type="file"
  accept=".csv"
  bind:this={fileInput}
  onchange={handleFileSelect}
  class="hidden"
/>

<!-- Warning Modal -->
<Modal show={showWarningModal} onClose={cancelImport}>
  <div class="flex items-start gap-3 mb-4">
    <div class="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
      <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <div class="flex-1">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Replace Current Wishlist?</h3>
      <p class="text-gray-600 mb-4">
        Import will replace your current wishlist. You currently have <strong>{$totalWishlisted} cards</strong> on your wishlist.
      </p>
      {#if importResult}
        <p class="text-sm text-gray-500 mb-4">
          The import will add <strong>{importResult.imported} cards</strong>.
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
      class="px-4 py-2 text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors font-medium"
    >
      Replace Wishlist
    </button>
  </div>
</Modal>

<!-- Result Modal -->
<Modal show={showResultModal && importResult !== null} onClose={closeResultModal}>
  {#if importResult}
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
              Successfully imported <strong>{importResult.imported} cards</strong> to your wishlist.
            </p>
            {#if importResult.skipped > 0}
              <p class="text-sm text-yellow-600 mb-2">
                Skipped {importResult.skipped} invalid card(s).
              </p>
            {/if}
            {#if importResult.errors.length > 0}
              <div class="text-xs text-gray-500 mt-2 max-h-40 overflow-y-auto">
                {#each importResult.errors.slice(0, 10) as error}
                  <p>{error}</p>
                {/each}
                {#if importResult.errors.length > 10}
                  <p class="text-gray-400">...and {importResult.errors.length - 10} more</p>
                {/if}
              </div>
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
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex justify-end mt-4">
        <button
          onclick={closeResultModal}
          class="px-4 py-2 text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors font-medium"
        >
          Close
        </button>
      </div>
  {/if}
</Modal>
