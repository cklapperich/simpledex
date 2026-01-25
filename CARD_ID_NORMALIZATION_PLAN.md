# Card ID Normalization Plan

## Current State

**Problem**: Card IDs in the final output (`cards-western.json`) have inconsistent formatting:
- 3,745 cards have leading zeros in their card numbers (e.g., `swsh12-099`, `A1-001`)
- Some set IDs have dots (e.g., `swsh12.5`)
- Some set IDs have leading zeros (e.g., `sv01`, `swsh03`)

**Root Cause**:
- Card IDs are created directly from raw tcgdex filenames without normalization
- A `normalizeCardId()` function EXISTS (lines 189-211 in `build-multi-language.ts`) but is ONLY used for matching cards between tcgdex and pokemon-tcg-data
- The final card output uses the raw, unnormalized IDs

## What Needs to Be Normalized

### 1. Card Numbers - Remove Leading Zeros
- `099` → `99`
- `001` → `1`
- `08` → `8`
- **Preserve variant suffixes**: `10a`, `103b` stay as-is
- **Preserve letter prefixes**: `TG22`, `GG36`, `RC1` stay as-is

### 2. Set IDs - Remove Leading Zeros from Numeric Parts
- `sv01` → `sv1`
- `swsh03` → `swsh3`
- `A1` → stays `A1` (no leading zero on "1")

### 3. Set IDs - Remove Dots
- `swsh12.5` → `swsh125`
- `sv10.5w` → `sv105w`

### 4. Set IDs - Remove "pt" Notation
- `swsh12pt5` → `swsh125`

## Existing Normalization Function

The `normalizeCardId()` function (lines 189-211) already handles all of the above:

```typescript
function normalizeCardId(id: string): string {
  const parts = id.split('-');
  if (parts.length < 2) return id;

  let setId = parts[0];
  let cardNumber = parts.slice(1).join('-');

  // Remove dots from set ID
  setId = setId.replace(/\./g, '');

  // Convert "pt" notation to match (swsh12pt5 -> swsh125)
  setId = setId.replace(/pt/g, '');

  // Remove leading zeros from numbers in set ID (sv01 -> sv1, swsh03 -> swsh3)
  setId = setId.replace(/([a-z]+)0+(\d+)/g, '$1$2');

  // Remove leading zeros from card number (004 -> 4, 099 -> 99)
  // Preserves variant suffixes like a, b, TG, GG, RC
  cardNumber = cardNumber.replace(/^0+(\d.*)/, '$1');

  return `${setId}-${cardNumber}`;
}
```

## Implementation Plan

### Step 1: Normalize in `build-multi-language.ts`

**Location**: Line 424 (where cardId is created)

**Current code**:
```typescript
const cardId = `${setId}-${cardNumber}`;
```

**New code**:
```typescript
const cardId = normalizeCardId(`${setId}-${cardNumber}`);
```

**Also normalize the number field** (line 430):
```typescript
number: cardNumber.replace(/^0+(\d.*)/, '$1'),
```

### Step 2: Normalize in `build-pokemon-tcg-data.ts`

**Location**: Lines 190 and 193 (where id and number are passed through)

**Current code**:
```typescript
id: ptcgCard.id,
...
number: ptcgCard.number,
```

**New code**:
```typescript
id: normalizeCardId(ptcgCard.id),
...
number: ptcgCard.number.replace(/^0+(\d.*)/, '$1'),
```

**Note**: Need to import or copy the `normalizeCardId` function to `build-pokemon-tcg-data.ts`

### Step 3: Create a Shared Utility

Since normalization is needed in multiple files, we should extract it:

**New file**: `build-utils.ts`
```typescript
export function normalizeCardId(id: string): string {
  const parts = id.split('-');
  if (parts.length < 2) return id;

  let setId = parts[0];
  let cardNumber = parts.slice(1).join('-');

  setId = setId.replace(/\./g, '');
  setId = setId.replace(/pt/g, '');
  setId = setId.replace(/([a-z]+)0+(\d+)/g, '$1$2');
  cardNumber = cardNumber.replace(/^0+(\d.*)/, '$1');

  return `${setId}-${cardNumber}`;
}

export function normalizeCardNumber(number: string): string {
  return number.replace(/^0+(\d.*)/, '$1');
}
```

Then import in both build files.

## Edge Cases to Preserve

### ✅ Should normalize:
- `swsh12-099` → `swsh12-99`
- `sv01-001` → `sv1-1`
- `swsh12.5-GG36` → `swsh125-GG36`

### ✅ Should preserve:
- `sm35-10a` → `sm35-10a` (variant suffix)
- `ecard2-103b` → `ecard2-103b` (variant suffix)
- `swsh9-TG22` → `swsh9-TG22` (letter prefix)
- `bw11-RC1` → `bw11-RC1` (letter prefix)
- `A1-123` → `A1-123` (already normalized)

## Impact

### Cards Affected:
- **3,745 cards** with leading zeros in card numbers
- Additional cards with dots or "pt" notation in set IDs
- Estimated **~4,000 total cards** will have normalized IDs

### Benefits:
1. **Consistent IDs**: All card IDs follow the same format
2. **Easier searching**: Users can search by "99" instead of needing to know "099"
3. **Smaller file size**: Removing zeros reduces JSON file size slightly
4. **Matches common conventions**: Most Pokemon TCG tools use normalized IDs

### Breaking Changes:
⚠️ **This will change card IDs** - any external references to cards with leading zeros will break
- If there's a collection system that stores card IDs, it will need to be updated
- URLs or bookmarks with old card IDs will need remapping
- Consider creating a migration mapping file: `old_id -> new_id`

## Testing Plan

1. **Before rebuild**: Save current `cards-western.json` as `cards-western-before.json`
2. **Run build**: Execute `npm run build-cards`
3. **Verify normalizations**:
   ```bash
   # Should return 0 (no leading zeros)
   jq '[.[] | select(.number | test("^0+\\d"))] | length' public/cards-western.json

   # Should return 0 (no dots in IDs)
   jq '[.[] | select(.id | contains("."))] | length' public/cards-western.json
   ```
4. **Spot check examples**:
   ```bash
   # Should show normalized IDs
   jq '.[] | select(.id == "swsh12-99" or .id == "sv1-1") | {id, number}' public/cards-western.json
   ```
5. **Create migration map**:
   ```bash
   # Generate old_id -> new_id mapping for any systems that need it
   jq -r 'map({old: .id, new: .id | ... }) | .[]' cards-western-before.json > migration.json
   ```

## Files to Modify

1. ✅ Already modified: `build-multi-language.ts` (supertype and -GX normalization)
2. ✅ Already modified: `build-pokemon-tcg-data.ts` (supertype and -GX normalization)
3. ✅ Already modified: `src/utils/cardFilters.ts` (supertype check)
4. ⏳ **TODO**: Extract `normalizeCardId()` to `build-utils.ts`
5. ⏳ **TODO**: Apply normalization to card ID creation in `build-multi-language.ts`
6. ⏳ **TODO**: Apply normalization to card ID in `build-pokemon-tcg-data.ts`
7. ⏳ **TODO**: Apply normalization to number field in both files

## Rollout Steps

1. Create `build-utils.ts` with shared normalization functions
2. Update `build-multi-language.ts` to use normalization
3. Update `build-pokemon-tcg-data.ts` to use normalization
4. Test build locally with sample data
5. Run full build: `npm run build-cards`
6. Verify output with test queries
7. If collection system exists, run migration script
8. Commit changes
