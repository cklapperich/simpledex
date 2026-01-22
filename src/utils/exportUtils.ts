import type { Collection, Card, EnrichedCard } from '../types';
import { buildSetToPTCGOMap } from './importUtils';
import { sortCardsBySetAndNumber } from './cardSorting';

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
  sortCardsBySetAndNumber(enriched);

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
 * Generates PTCGO format string for a card
 * Format: [quantity] [card name] [ptcgoCode] [number]
 * Example: "1 Mimikyu TEU 112" or "3 Mimikyu TEU 112"
 */
function generatePTCGOFormat(
  card: Card,
  quantity: number,
  ptcgoCodeMap: Map<string, string>
): string {
  const setId = card.id.split('-')[0];
  const ptcgoCode = ptcgoCodeMap.get(setId) || card.ptcgoCode || 'UNKNOWN';
  const cardName = card.names['en'] || card.names[Object.keys(card.names)[0]] || 'Unknown';
  return `${quantity} ${cardName} ${ptcgoCode} ${card.number}`;
}

/**
 * Generates CSV export with proper escaping
 * Format: Card ID, Card Name, Set, Number, Quantity, PTCGO
 * PTCGO column includes quantity matching the Quantity field
 */
export function generateCSV(
  collection: Collection,
  cardMap: Map<string, Card>
): string {
  const enrichedCards = enrichCollectionData(collection, cardMap);

  // Build PTCGO code map for exports
  const ptcgoCodeMap = buildSetToPTCGOMap(cardMap);

  // CSV header
  const headers = ['Card ID', 'Card Name', 'Set', 'Number', 'Quantity', 'PTCGO'];
  const rows = [headers.join(',')];

  // Add data rows
  for (const card of enrichedCards) {
    const ptcgoFormat = generatePTCGOFormat(card, card.quantity, ptcgoCodeMap);
    const cardName = card.names['en'] || card.names[Object.keys(card.names)[0]] || 'Unknown';
    const row = [
      escapeCSVField(card.id),
      escapeCSVField(cardName),
      escapeCSVField(card.set),
      escapeCSVField(card.number),
      escapeCSVField(card.quantity),
      escapeCSVField(ptcgoFormat)
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
