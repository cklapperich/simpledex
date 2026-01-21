import type { Collection, Card, ImportResult } from '../types';

/**
 * Parses a CSV field, handling quoted values with commas and escaped quotes
 */
function parseCSVField(field: string): string {
  field = field.trim();

  // If field is quoted, remove quotes and unescape internal quotes
  if (field.startsWith('"') && field.endsWith('"')) {
    return field.slice(1, -1).replace(/""/g, '"');
  }

  return field;
}

/**
 * Parses a CSV row into fields, handling quoted values properly
 */
function parseCSVRow(row: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
        currentField += char;
      }
    } else if (char === ',' && !insideQuotes) {
      // Field separator
      fields.push(parseCSVField(currentField));
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Add last field
  fields.push(parseCSVField(currentField));

  return fields;
}

/**
 * Parses CSV content and returns a Collection object
 * Returns ImportResult with errors if parsing fails
 */
export function parseCSV(csvContent: string): { collection?: Collection; result?: ImportResult } {
  const lines = csvContent.split('\n').filter(line => line.trim());

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

  // Parse and validate headers
  const headers = parseCSVRow(lines[0]);
  const expectedHeaders = ['Card ID', 'Card Name', 'Set', 'Number', 'Quantity'];

  if (headers.length !== expectedHeaders.length ||
      !headers.every((h, i) => h === expectedHeaders[i])) {
    return {
      result: {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [`Invalid CSV format - expected headers: ${expectedHeaders.join(', ')}`]
      }
    };
  }

  // Parse data rows
  const collection: Collection = {};
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);

    if (row.length !== 5) {
      errors.push(`Line ${i + 1}: Invalid number of fields (expected 5, got ${row.length})`);
      skipped++;
      continue;
    }

    const [cardId, , , , quantityStr] = row;

    // Validate quantity
    const quantity = parseInt(quantityStr);
    if (isNaN(quantity) || quantity < 1 || quantity > 99) {
      errors.push(`Line ${i + 1}: Invalid quantity "${quantityStr}" (must be 1-99)`);
      skipped++;
      continue;
    }

    // Add to collection (last occurrence wins for duplicates)
    collection[cardId] = quantity;
  }

  const imported = Object.keys(collection).length;

  if (imported === 0 && lines.length > 1) {
    return {
      result: {
        success: false,
        imported: 0,
        skipped,
        errors: errors.length > 0 ? errors : ['No valid cards found in CSV']
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

  for (const [cardId, quantity] of Object.entries(collection)) {
    if (cardMap.has(cardId)) {
      validCollection[cardId] = quantity;
    } else {
      invalidIds.push(cardId);
    }
  }

  const imported = Object.keys(validCollection).length;
  const skipped = invalidIds.length;
  const errors: string[] = [];

  if (skipped > 0) {
    errors.push(`Skipped ${skipped} card(s) with invalid IDs: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '...' : ''}`);
  }

  return {
    success: imported > 0,
    imported,
    skipped,
    errors
  };
}
