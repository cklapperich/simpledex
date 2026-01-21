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
 * Supports both legacy format (Card ID, Card Name, Set, Number, Quantity)
 * and PTCGO format (PTCGO, Variant, ...)
 */
export function parseCSV(csvContent: string, cardMap?: Map<string, Card>): {
  collection?: Collection;
  cardNames?: Map<string, string>;
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

  // Parse headers to detect format
  const headers = parseCSVRow(lines[0]);

  // Check if this is PTCGO format (has PTCGO column)
  const hasPTCGOColumn = headers.some(h => h.toUpperCase() === 'PTCGO');
  if (hasPTCGOColumn) {
    if (!cardMap) {
      return {
        result: {
          success: false,
          imported: 0,
          skipped: 0,
          errors: ['Card map is required for PTCGO format import']
        }
      };
    }
    return parsePTCGOCSV(csvContent, cardMap);
  }

  // Legacy format validation
  const expectedHeaders = ['Card ID', 'Card Name', 'Set', 'Number', 'Quantity'];

  if (headers.length !== expectedHeaders.length ||
      !headers.every((h, i) => h === expectedHeaders[i])) {
    return {
      result: {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [`Invalid CSV format - expected headers: ${expectedHeaders.join(', ')} or PTCGO format`]
      }
    };
  }

  // Parse data rows
  const collection: Collection = {};
  const cardNames = new Map<string, string>();
  const errors: string[] = [];
  const detailedErrors: ImportError[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);

    if (row.length !== 5) {
      const errorMsg = `Line ${i + 1}: Invalid number of fields (expected 5, got ${row.length})`;
      errors.push(errorMsg);
      detailedErrors.push({
        line: i + 1,
        message: errorMsg,
        type: 'parsing'
      });
      skipped++;
      continue;
    }

    const [cardId, cardName, , , quantityStr] = row;

    // Store card name for later use
    cardNames.set(cardId, cardName);

    // Validate quantity
    const quantity = parseInt(quantityStr);
    if (isNaN(quantity) || quantity < 1 || quantity > 99) {
      const errorMsg = `Invalid quantity "${quantityStr}" (must be 1-99)`;
      errors.push(`Line ${i + 1}: ${errorMsg}`);
      detailedErrors.push({
        line: i + 1,
        cardId,
        cardName,
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

  return { collection, cardNames };
}

/**
 * Validates imported collection against card database
 * Returns stats about imported/skipped cards
 */
export function validateImport(
  collection: Collection,
  cardMap: Map<string, Card>,
  cardNames?: Map<string, string>
): ImportResult {
  const validCollection: Collection = {};
  const invalidIds: string[] = [];
  const detailedErrors: ImportError[] = [];

  for (const [cardId, quantity] of Object.entries(collection)) {
    if (cardMap.has(cardId)) {
      validCollection[cardId] = quantity;
    } else {
      invalidIds.push(cardId);
      const cardName = cardNames?.get(cardId);
      detailedErrors.push({
        cardId,
        cardName,
        message: `Card not found in database`,
        type: 'validation'
      });
    }
  }

  const imported = Object.keys(validCollection).length;
  const skipped = invalidIds.length;
  const errors: string[] = [];

  if (skipped > 0) {
    // Show card names if available, otherwise show IDs
    const displayList = invalidIds.slice(0, 5).map(id => {
      const name = cardNames?.get(id);
      return name ? `${name} (${id})` : id;
    });
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
 * PTCGO Format Import/Export Utilities
 */

/**
 * Build ptcgoCode → setId mapping from cards
 */
function buildPTCGOToSetMap(cardMap: Map<string, Card>): Map<string, string> {
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
 */
interface PTCGOParsedLine {
  quantity: number;
  cardName: string;
  ptcgoCode: string;
  cardNumber: string;
  rawLine: string;
}

/**
 * Parses a PTCGO format line
 * Format: [quantity] [card name] [ptcgoCode] [number]
 * Example: "1 Mimikyu TEU 112"
 */
function parsePTCGOLine(line: string): PTCGOParsedLine | null {
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

  // Second-to-last token is PTCGO code (2-4 uppercase letters)
  const ptcgoCode = tokens[tokens.length - 2];
  if (!/^[A-Z]{2,4}$/i.test(ptcgoCode)) {
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

/**
 * Parses PTCGO format CSV content
 * Expected format: PTCGO column (+ optional Variant column) + optional other columns
 */
export function parsePTCGOCSV(
  csvContent: string,
  cardMap: Map<string, Card>
): {
  collection?: Collection;
  cardNames?: Map<string, string>;
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

  // Parse headers
  const headers = parseCSVRow(lines[0]);

  // Find PTCGO column index
  const ptcgoIndex = headers.findIndex(h => h.toUpperCase() === 'PTCGO');
  if (ptcgoIndex === -1) {
    return {
      result: {
        success: false,
        imported: 0,
        skipped: 0,
        errors: ['CSV must have a "PTCGO" column']
      }
    };
  }

  // Build PTCGO code mapping
  const ptcgoToSetMap = buildPTCGOToSetMap(cardMap);

  // Parse data rows
  const collection: Collection = {};
  const cardNames = new Map<string, string>();
  const errors: string[] = [];
  const detailedErrors: ImportError[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);

    if (row.length <= ptcgoIndex) {
      const errorMsg = `Line ${i + 1}: Missing PTCGO column`;
      errors.push(errorMsg);
      detailedErrors.push({
        line: i + 1,
        message: errorMsg,
        type: 'parsing'
      });
      skipped++;
      continue;
    }

    const ptcgoValue = row[ptcgoIndex];
    if (!ptcgoValue || !ptcgoValue.trim()) {
      skipped++;
      continue; // Skip empty PTCGO values
    }

    // Parse PTCGO line
    const parsed = parsePTCGOLine(ptcgoValue);
    if (!parsed) {
      const errorMsg = `Invalid PTCGO format: "${ptcgoValue}"`;
      errors.push(`Line ${i + 1}: ${errorMsg}`);
      detailedErrors.push({
        line: i + 1,
        message: errorMsg,
        type: 'parsing'
      });
      skipped++;
      continue;
    }

    // Map PTCGO code to set ID
    const setId = ptcgoToSetMap.get(parsed.ptcgoCode);
    if (!setId) {
      const errorMsg = `Unknown PTCGO code: "${parsed.ptcgoCode}"`;
      errors.push(`Line ${i + 1}: ${errorMsg}`);
      detailedErrors.push({
        line: i + 1,
        cardName: parsed.cardName,
        message: errorMsg,
        type: 'validation'
      });
      skipped++;
      continue;
    }

    // Construct card ID
    const cardId = `${setId}-${parsed.cardNumber}`;

    // Validate card exists
    if (!cardMap.has(cardId)) {
      const errorMsg = `Card not found: ${parsed.cardName} (${cardId})`;
      errors.push(`Line ${i + 1}: ${errorMsg}`);
      detailedErrors.push({
        line: i + 1,
        cardId,
        cardName: parsed.cardName,
        message: errorMsg,
        type: 'validation'
      });
      skipped++;
      continue;
    }

    // Add to collection
    collection[cardId] = parsed.quantity;
    cardNames.set(cardId, parsed.cardName);
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

  return { collection, cardNames };
}
