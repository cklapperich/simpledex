import Papa from 'papaparse';
import type { Collection, Card, ImportResult, ImportError } from '../types';

/**
 * Parses CSV content and returns a Collection object
 * Returns ImportResult with errors if parsing fails
 * Only requires: Card ID, Quantity (all other columns optional)
 */
export function parseCSV(csvContent: string): {
  collection?: Collection;
  result?: ImportResult;
} {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.data.length === 0) {
    return {
      result: {
        success: false,
        imported: 0,
        skipped: 0,
        errors: ['File is empty']
      }
    };
  }

  // Check for required columns
  const headers = parsed.meta.fields || [];
  if (!headers.includes('Card ID') || !headers.includes('Quantity')) {
    return {
      result: {
        success: false,
        imported: 0,
        skipped: 0,
        errors: ['CSV must have "Card ID" and "Quantity" columns']
      }
    };
  }

  // Parse data rows
  const collection: Collection = {};
  const errors: string[] = [];
  const detailedErrors: ImportError[] = [];
  let skipped = 0;

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const lineNum = i + 2; // +2 for 1-based index and header row

    const cardId = row['Card ID'];
    const quantityStr = row['Quantity'];

    if (!cardId || !quantityStr) {
      const errorMsg = `Line ${lineNum}: Missing required columns`;
      errors.push(errorMsg);
      detailedErrors.push({
        line: lineNum,
        message: errorMsg,
        type: 'parsing'
      });
      skipped++;
      continue;
    }

    // Validate quantity
    const quantity = parseInt(quantityStr);
    if (isNaN(quantity) || quantity < 1 || quantity > 99) {
      const errorMsg = `Invalid quantity "${quantityStr}" (must be 1-99)`;
      errors.push(`Line ${lineNum}: ${errorMsg}`);
      detailedErrors.push({
        line: lineNum,
        cardId,
        message: errorMsg,
        type: 'quantity'
      });
      skipped++;
      continue;
    }

    // Add to collection (merge duplicates by adding quantities)
    collection[cardId] = (collection[cardId] || 0) + quantity;
  }

  const imported = Object.keys(collection).length;

  if (imported === 0 && parsed.data.length > 0) {
    return {
      result: {
        success: false,
        imported: 0,
        skipped,
        errors: errors.length > 0 ? errors : ['No valid cards found in CSV'],
        detailedErrors
      }
    };
  }

  return { collection };
}

/**
 * Validates imported collection against card database
 * Returns stats about imported/skipped cards
 */
export function validateImport(
  collection: Collection,
  cardMap: Map<string, Card>
): ImportResult {
  const validCollection: Collection = {};
  const invalidIds: string[] = [];
  const detailedErrors: ImportError[] = [];

  for (const [cardId, quantity] of Object.entries(collection)) {
    if (cardMap.has(cardId)) {
      validCollection[cardId] = quantity;
    } else {
      invalidIds.push(cardId);
      detailedErrors.push({
        cardId,
        message: `Card not found in database`,
        type: 'validation'
      });
    }
  }

  const imported = Object.keys(validCollection).length;
  const skipped = invalidIds.length;
  const errors: string[] = [];

  if (skipped > 0) {
    // Show just IDs in summary
    const displayList = invalidIds.slice(0, 5);
    errors.push(`Skipped ${skipped} card(s) with invalid IDs: ${displayList.join(', ')}${invalidIds.length > 5 ? '...' : ''}`);
  }

  return {
    success: imported > 0,
    imported,
    skipped,
    errors,
    detailedErrors: detailedErrors.length > 0 ? detailedErrors : undefined
  };
}

