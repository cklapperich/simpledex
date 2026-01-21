import type { Collection, Card, EnrichedCard } from '../types';

/**
 * Enriches collection data with full card details from cardMap
 * Filters out cards not found in cardMap and sorts by set name, then card number
 */
export function enrichCollectionData(
  collection: Collection,
  cardMap: Map<string, Card>
): EnrichedCard[] {
  const enriched: EnrichedCard[] = [];

  for (const [cardId, quantity] of Object.entries(collection)) {
    const card = cardMap.get(cardId);
    if (card) {
      enriched.push({
        ...card,
        quantity
      });
    }
  }

  // Sort by set name, then by card number
  enriched.sort((a, b) => {
    // First compare by set name
    const setCompare = a.set.localeCompare(b.set);
    if (setCompare !== 0) return setCompare;

    // Then compare by card number (convert to numbers if possible)
    const aNum = parseInt(a.number);
    const bNum = parseInt(b.number);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    // Fallback to string comparison if not numeric
    return a.number.localeCompare(b.number);
  });

  return enriched;
}

/**
 * Escapes a CSV field by wrapping in quotes and escaping internal quotes
 */
function escapeCSVField(field: string | number): string {
  const str = String(field);
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates CSV export with proper escaping
 */
export function generateCSV(
  collection: Collection,
  cardMap: Map<string, Card>
): string {
  const enrichedCards = enrichCollectionData(collection, cardMap);

  // CSV header
  const headers = ['Card ID', 'Card Name', 'Set', 'Number', 'Quantity'];
  const rows = [headers.join(',')];

  // Add data rows
  for (const card of enrichedCards) {
    const row = [
      escapeCSVField(card.id),
      escapeCSVField(card.name),
      escapeCSVField(card.set),
      escapeCSVField(card.number),
      escapeCSVField(card.quantity)
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Triggers a browser download for the given content
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  try {
    // Create blob with specified MIME type
    const blob = new Blob([content], { type: mimeType });

    // Create temporary download URL
    const url = URL.createObjectURL(blob);

    // Create temporary anchor element and trigger download
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();

    // Cleanup
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download file:', error);
    throw error;
  }
}

/**
 * Generates CSV filename with current date
 */
export function generateFilename(format: 'csv'): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `pokemon-collection-csv-${date}.csv`;
}
