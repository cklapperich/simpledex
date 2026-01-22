<script lang="ts">
  import { wishlist, totalWishlisted } from '../stores/wishlist';
  import { cardMap } from '../stores/cards';
  import { downloadFile } from '../utils/exportUtils';
  import type { Card } from '../types';

  function escapeCSVField(field: string | number): string {
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function generateWishlistCSV(): string {
    const wishlistCards: Card[] = [];

    // Get all wishlisted cards
    for (const cardId in $wishlist) {
      if ($wishlist[cardId]) {
        const card = $cardMap.get(cardId);
        if (card) {
          wishlistCards.push(card);
        }
      }
    }

    // Sort by set and number
    wishlistCards.sort((a, b) => {
      if (a.set !== b.set) return a.set.localeCompare(b.set);
      return a.number.localeCompare(b.number);
    });

    // CSV header
    const headers = ['Card ID', 'Card Name', 'Set', 'Number'];
    const rows = [headers.join(',')];

    // Add data rows
    for (const card of wishlistCards) {
      const row = [
        escapeCSVField(card.id),
        escapeCSVField(card.name),
        escapeCSVField(card.set),
        escapeCSVField(card.number)
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  function handleExport() {
    try {
      const csvContent = generateWishlistCSV();
      const date = new Date().toISOString().split('T')[0];
      const filename = `pokemon-wishlist-${date}.csv`;
      downloadFile(csvContent, filename, 'text/csv');
    } catch (error) {
      console.error('Failed to export wishlist CSV:', error);
      alert('Failed to export wishlist. Please try again.');
    }
  }
</script>

{#if $totalWishlisted > 0}
  <button
    onclick={handleExport}
    class="flex items-center gap-2 px-5 py-3 bg-yellow-500 text-white rounded-full shadow-lg hover:bg-yellow-600 hover:shadow-xl transition-all duration-200 font-medium"
    title="Export your wishlist as CSV"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
    Export Wishlist
  </button>
{/if}
