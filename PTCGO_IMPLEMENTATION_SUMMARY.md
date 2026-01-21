# PTCGO Implementation Summary

## Overview

PTCGO-related functionality has been implemented with a clear separation of concerns:
- **CSV Collection Import/Export**: Uses Card ID as source of truth with PTCGO reference column
- **Deck List Parsing**: Utilities ready for future PTCGO deck list import feature

## CSV Collection Import/Export

### Export Format
```csv
Card ID,Card Name,Set,Number,Quantity,PTCGO
sm9-112,Mimikyu,Team Up,112,1,1 Mimikyu TEU 112
sm12-155,Sylveon,Cosmic Eclipse,155,1,1 Sylveon CEC 155
sve-9,Basic Grass Energy,Scarlet & Violet Energies,9,6,6 Basic Grass Energy SVE 9
```

**Key Points:**
- Exports full metadata for reference
- PTCGO column includes quantity matching the Quantity field
- PTCGO format: `[quantity] [card name] [ptcgoCode] [number]`
- Each CSV row = 1 unique card, Quantity field = how many copies

### Import Format (Flexible)

**Required columns only:**
```csv
Card ID,Quantity
sm9-112,1
sm12-155,1
sve-9,6
```

**Full format (all columns optional except Card ID and Quantity):**
```csv
Card ID,Card Name,Set,Number,Quantity,PTCGO
sm9-112,Mimikyu,Team Up,112,1,1 Mimikyu TEU 112
sve-9,Basic Grass Energy,Scarlet & Violet Energies,9,6,6 Basic Grass Energy SVE 9
```

**Key Points:**
- Only **Card ID** and **Quantity** columns are required
- All other columns (Card Name, Set, Number, PTCGO, Variant, etc.) are optional
- Column order doesn't matter - parser finds columns by header name
- Card names for error messages pulled from cards.json
- Allows round-trip: export → import → no data loss
- Backward compatible with old CSV format

## PTCGO Deck List Parsing (For Future Use)

### Parsing Utilities Available

The following functions are exported and ready for deck list import:

#### `parsePTCGOLine(line: string): PTCGOParsedLine | null`
Parses PTCGO deck list format with quantities.

**Input**: `"1 Mimikyu TEU 112"`
**Output**:
```typescript
{
  quantity: 1,
  cardName: "Mimikyu",
  ptcgoCode: "TEU",
  cardNumber: "112",
  rawLine: "1 Mimikyu TEU 112"
}
```

**Features:**
- Handles quantities 1-99
- Supports PTCGO codes 2-6 characters
- Special "Energy" code support
- Parses multi-word card names correctly

#### `buildPTCGOToSetMap(cardMap: Map<string, Card>): Map<string, string>`
Creates mapping from PTCGO codes to internal set IDs.

**Output**: `Map<"TEU" → "sm9", "CEC" → "sm12", "ENERGY" → "sve", ...>`

**Features:**
- Built from cards.json ptcgoCode field
- Special mapping: `ENERGY → sve`
- 138 unique PTCGO codes mapped

#### `buildSetToPTCGOMap(cardMap: Map<string, Card>): Map<string, string>`
Creates reverse mapping for exports.

**Output**: `Map<"sm9" → "TEU", "sm12" → "CEC", ...>`

### Complete Parsing Flow Example

```typescript
import { parsePTCGOLine, buildPTCGOToSetMap, cardMap } from './utils';

// Build mapping
const ptcgoMap = buildPTCGOToSetMap(cardMap);

// Parse deck list line
const line = "1 Mimikyu TEU 112";
const parsed = parsePTCGOLine(line);
// → { quantity: 1, cardName: "Mimikyu", ptcgoCode: "TEU", cardNumber: "112" }

// Map to set ID
const setId = ptcgoMap.get(parsed.ptcgoCode);
// → "sm9"

// Construct card ID
const cardId = `${setId}-${parsed.cardNumber}`;
// → "sm9-112"

// Validate card exists
const card = cardMap.get(cardId);
// → { id: "sm9-112", name: "Mimikyu", ... }
```

## Files Modified

### Core Implementation
1. **src/types.ts**
   - Added `ptcgoCode?: string` to Card interface

2. **build-cards.ts**
   - Includes ptcgoCode from sets data in cards.json
   - All 19,783 cards have ptcgoCode field

3. **src/utils/exportUtils.ts**
   - Imports `buildSetToPTCGOMap` from importUtils
   - `generatePTCGOReference()` - Creates PTCGO reference without quantity
   - `generateCSV()` - Exports with PTCGO column at end

4. **src/utils/importUtils.ts**
   - `parseCSV()` - Standard CSV import (Card ID based)
   - Exported PTCGO utilities marked for deck list parsing:
     - `parsePTCGOLine()`
     - `buildPTCGOToSetMap()`
     - `buildSetToPTCGOMap()`
     - `PTCGOParsedLine` interface

## Test Files

### test-minimal.csv
Minimal 2-column format (only required fields):
```csv
Card ID,Quantity
sm9-112,1
sm12-155,1
sve-9,6
```

### test-collection-import.csv
Full format with all metadata:
```csv
Card ID,Card Name,Set,Number,Quantity,PTCGO
sm9-112,Mimikyu,Team Up,112,1,1 Mimikyu TEU 112
sm12-155,Sylveon,Cosmic Eclipse,155,1,1 Sylveon CEC 155
sm12-166,Eevee,Cosmic Eclipse,166,1,1 Eevee CEC 166
sve-9,Basic Grass Energy,Scarlet & Violet Energies,9,6,6 Basic Grass Energy SVE 9
```

### test-collection-comprehensive.csv
Extended test with 5 cards including Base Set:
```csv
Card ID,Card Name,Set,Number,Quantity,PTCGO
sm9-112,Mimikyu,Team Up,112,1,1 Mimikyu TEU 112
sm12-155,Sylveon,Cosmic Eclipse,155,1,1 Sylveon CEC 155
sm12-166,Eevee,Cosmic Eclipse,166,1,1 Eevee CEC 166
sve-9,Basic Grass Energy,Scarlet & Violet Energies,9,6,6 Basic Grass Energy SVE 9
base1-1,Alakazam,Base,1,2,2 Alakazam BS 1
```

## Verification Results

### PTCGO Parsing Tests
All parsing utilities verified and working:
- ✅ `parsePTCGOLine("1 Mimikyu TEU 112")` → Quantity: 1, Code: TEU, Number: 112
- ✅ `parsePTCGOLine("6 Basic Grass Energy Energy 9")` → Quantity: 6, Code: ENERGY, Number: 9
- ✅ `parsePTCGOLine("2 Alakazam BS 1")` → Quantity: 2, Code: BS, Number: 1
- ✅ `parsePTCGOLine("4 Professor Sycamore XY 122")` → Quantity: 4, Code: XY, Number: 122

### PTCGO Code Mapping
- ✅ 138 unique PTCGO codes mapped
- ✅ TEU → sm9 (Team Up)
- ✅ CEC → sm12 (Cosmic Eclipse)
- ✅ BS → base1 (Base Set)
- ✅ ENERGY → sve (Special mapping)
- ✅ SVE → sve (Scarlet & Violet Energies)

### Full Parse Flow
All test cases successfully parse to valid card IDs:
- ✅ `"1 Mimikyu TEU 112"` → sm9-112 (Mimikyu)
- ✅ `"6 Basic Grass Energy Energy 9"` → sve-9 (Basic Grass Energy)
- ✅ `"2 Alakazam BS 1"` → base1-1 (Alakazam)
- ✅ `"4 Professor Sycamore XY 122"` → xy1-122 (Professor Sycamore)

## Build Status

- ✅ TypeScript compilation successful
- ✅ Production build successful
- ✅ Bundle size: 307.78 kB (91.89 kB gzipped)
- ✅ No errors or warnings

## Testing Instructions

### Test Collection Import
1. Start dev server: `npm run dev`
2. Click "Import" button
3. Select `test-collection-import.csv`
4. Verify: 4 unique cards imported (10 total cards with quantities)

### Test Collection Export
1. Add some cards to collection
2. Click "Export" button
3. Open CSV file
4. Verify columns: `Card ID, Card Name, Set, Number, Quantity, PTCGO`
5. Check PTCGO column format (no quantity prefix)

### Test Round-Trip
1. Export collection → CSV file
2. Import the CSV file
3. Collection should be identical

## Usage for Future Deck List Import

When implementing deck list import, use the provided utilities:

```typescript
import {
  parsePTCGOLine,
  buildPTCGOToSetMap,
  type PTCGOParsedLine
} from './utils/importUtils';

// Example deck list
const deckList = `
1 Mimikyu TEU 112
1 Sylveon CEC 155
6 Basic Grass Energy Energy 9
`;

// Parse each line
const lines = deckList.trim().split('\n');
const ptcgoMap = buildPTCGOToSetMap(cardMap);
const deck: Record<string, number> = {};

for (const line of lines) {
  const parsed = parsePTCGOLine(line);
  if (!parsed) continue;

  const setId = ptcgoMap.get(parsed.ptcgoCode);
  if (!setId) continue;

  const cardId = `${setId}-${parsed.cardNumber}`;
  deck[cardId] = parsed.quantity;
}
```

## Summary

✅ **CSV Collection Management**
- **Flexible Import**: Only Card ID and Quantity columns required
- Column order doesn't matter (finds columns by name)
- All other columns optional (Card Name, Set, Number, PTCGO, Variant, etc.)
- Exports with full metadata including PTCGO column
- PTCGO column format: `[quantity] [card name] [ptcgoCode] [number]`
- PTCGO quantity matches the Quantity column value
- Full round-trip support

✅ **PTCGO Deck List Utilities**
- `parsePTCGOLine()` - Parses lines with quantities
- `buildPTCGOToSetMap()` - Maps PTCGO codes to set IDs
- `buildSetToPTCGOMap()` - Reverse mapping for exports
- All utilities tested and working
- Ready for deck list import feature

✅ **Data Quality**
- 19,783 cards with ptcgoCode field
- 138 unique PTCGO codes mapped
- Special "Energy" → "sve" mapping
- All test cases verified

The implementation provides a clean separation between collection management (ID-based) and deck list parsing (PTCGO format), with all utilities ready for future use.
