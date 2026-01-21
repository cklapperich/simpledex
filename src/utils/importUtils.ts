import type { Collection, Card, ImportResult, ImportError } from '../types';

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
 * Only requires: Card ID, Quantity (all other columns optional)
 */
export function parseCSV(csvContent: string): {
  collection?: Collection;
  result?: ImportResult;
} {
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

  // Parse and validate headers - find required columns by name
  const headers = parseCSVRow(lines[0]);
  const cardIdIndex = headers.findIndex(h => h === 'Card ID');
  const quantityIndex = headers.findIndex(h => h === 'Quantity');

  if (cardIdIndex === -1 || quantityIndex === -1) {
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

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);

    // Check if row has enough columns
    const maxIndex = Math.max(cardIdIndex, quantityIndex);
    if (row.length <= maxIndex) {
      const errorMsg = `Line ${i + 1}: Missing required columns`;
      errors.push(errorMsg);
      detailedErrors.push({
        line: i + 1,
        message: errorMsg,
        type: 'parsing'
      });
      skipped++;
      continue;
    }

    const cardId = row[cardIdIndex];
    const quantityStr = row[quantityIndex];

    // Validate quantity
    const quantity = parseInt(quantityStr);
    if (isNaN(quantity) || quantity < 1 || quantity > 99) {
      const errorMsg = `Invalid quantity "${quantityStr}" (must be 1-99)`;
      errors.push(`Line ${i + 1}: ${errorMsg}`);
      detailedErrors.push({
        line: i + 1,
        cardId,
        message: errorMsg,
        type: 'quantity'
      });
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

/**
 * PTCGO Deck List Parsing Utilities (for future deck list import feature)
 * These functions are NOT used for CSV collection import/export
 */

/**
 * Build ptcgoCode → setId mapping from cards
 * Used for deck list parsing
 */
export function buildPTCGOToSetMap(cardMap: Map<string, Card>): Map<string, string> {
  const map = new Map<string, string>();

  // Special case mappings
  map.set('ENERGY', 'sve'); // Map generic "Energy" to Scarlet & Violet Energies

  // Build from card data
  for (const card of cardMap.values()) {
    if (card.ptcgoCode) {
      const setId = card.id.split('-')[0];
      map.set(card.ptcgoCode.toUpperCase(), setId);
    }
  }

  return map;
}

/**
 * Build reverse map for exports: setId → ptcgoCode
 * Used for generating PTCGO reference column in CSV exports
 */
export function buildSetToPTCGOMap(cardMap: Map<string, Card>): Map<string, string> {
  const map = new Map<string, string>();

  for (const card of cardMap.values()) {
    if (card.ptcgoCode) {
      const setId = card.id.split('-')[0];
      map.set(setId, card.ptcgoCode);
    }
  }

  return map;
}

/**
 * Parsed PTCGO line structure
 * Used for deck list parsing
 */
export interface PTCGOParsedLine {
  quantity: number;
  cardName: string;
  ptcgoCode: string;
  cardNumber: string;
  rawLine: string;
}

/**
 * Parses a PTCGO format line (for deck list imports)
 * Format: [quantity] [card name] [ptcgoCode] [number]
 * Example: "1 Mimikyu TEU 112"
 *
 * This function is used for parsing deck lists, NOT CSV collection imports
 */
export function parsePTCGOLine(line: string): PTCGOParsedLine | null {
  // Remove leading asterisk and whitespace if present
  line = line.trim().replace(/^\*\s*/, '');

  // Split into tokens
  const tokens = line.split(/\s+/);

  if (tokens.length < 4) {
    return null; // Not enough tokens
  }

  // First token is quantity
  const quantity = parseInt(tokens[0]);
  if (isNaN(quantity) || quantity < 1 || quantity > 99) {
    return null; // Invalid quantity
  }

  // Last token is number
  const cardNumber = tokens[tokens.length - 1];

  // Second-to-last token is PTCGO code (2-6 uppercase letters, or "Energy")
  const ptcgoCode = tokens[tokens.length - 2];
  if (!/^[A-Z]{2,6}$/i.test(ptcgoCode)) {
    return null; // Invalid PTCGO code
  }

  // Everything between quantity and PTCGO code is the card name
  const cardName = tokens.slice(1, tokens.length - 2).join(' ');

  return {
    quantity,
    cardName,
    ptcgoCode: ptcgoCode.toUpperCase(),
    cardNumber,
    rawLine: line
  };
}
