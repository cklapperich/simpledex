import Papa from 'papaparse';
import type { Collection, Card, EnrichedCard } from '../types';
import { sortCardsBySetAndNumber } from './cardSorting';
import { getCardName } from './cardUtils';

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
 * Generates PTCGO format string for a card
 * Format: [quantity] [card name] [setName] [number]
 * Example: "1 Mimikyu Prismatic Evolutions 112" or "3 Mimikyu Prismatic Evolutions 112"
 */
function generatePTCGOFormat(card: Card, quantity: number): string {
  const setName = card.set || 'UNKNOWN';
  return `${quantity} ${getCardName(card)} ${setName} ${card.number}`;
}

/**
 * Generates CSV export using papaparse
 * Format: Card ID, Card Name, Set, Number, Quantity, PTCGO
 */
export function generateCSV(
  collection: Collection,
  cardMap: Map<string, Card>
): string {
  const enrichedCards = enrichCollectionData(collection, cardMap);

  const data = enrichedCards.map(card => ({
    'Card ID': card.id,
    'Card Name': getCardName(card),
    'Set': card.set,
    'Number': card.number,
    'Quantity': card.quantity,
    'PTCGO': generatePTCGOFormat(card, card.quantity)
  }));

  return Papa.unparse(data);
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
