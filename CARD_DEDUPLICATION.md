# Card Deduplication - Tribal Knowledge

## The Problem

We merge two Pokemon TCG databases with **incompatible ID formats**:
- **TCGdex**: Uses dots, leading zeros, suffixes (`sm7.5`, `sv01`, `swsh12.5`, `lc`)
- **pokemon-tcg-data**: Uses "pt" notation, no dots, no zeros (`sm75`, `sv1`, `swsh12pt5`, `base6`)

Without deduplication, the same card appears multiple times with different IDs.

## Example Duplicates

| Card | TCGdex ID | Pokemon-TCG-Data ID | Set Name | Number |
|------|-----------|---------------------|----------|--------|
| Weedle | `lc-99` | `base6-99` | Legendary Collection | 99 |
| Kingdra GX | `sm7.5-66` | `sm75-66` | Dragon Majesty | 66 |
| Reshiram ex | `sv10.5w-173` | `rsv10pt5-173` | White Flare | 173 |
| Chespin | `xyp-XY01` | `xyp-XY01` | XY Black Star Promos | XY01 |

## Three-Strategy Matching

The build script tries **three strategies** to match cards (in order):

### Strategy 1: Exact ID Match
```typescript
pokemonTCGData.cards.get('lc-99')  // Direct lookup
```

### Strategy 2: Normalized ID Match
```typescript
// Normalizes: removes dots, "pt", leading zeros
normalizeCardId('sm7.5') → 'sm75'
normalizeCardId('sv01') → 'sv1'
normalizeCardId('swsh12.5') → 'swsh125'
normalizeCardId('swsh12pt5') → 'swsh125'  // Match!
```

### Strategy 3: Set Name + Card Number Match
```typescript
// When IDs are completely different (lc vs base6)
// Fall back to matching by set metadata
tcgdexKey: "Legendary Collection|99"
ptcgKey:   "Legendary Collection|99"  // Match!
```

## Implementation Details

### Secondary Index (Strategy 3)
Pokemon-tcg-data cards don't have a `set` property - we build a secondary index:

```typescript
// During load: extract set ID from card ID, look up set name
const setId = card.id.split('-')[0];  // 'base6'
const set = sets.get(setId);           // {name: "Legendary Collection"}
cardsBySetAndNumber.set("Legendary Collection|99", card);
```

### Duplicate Prevention
When adding "missing" cards from pokemon-tcg-data, check all three strategies:

```typescript
if (!tcgdexCardIds.has(cardId) &&              // Strategy 1
    !tcgdexNormalizedIds.has(normalizedId) &&  // Strategy 2
    !tcgdexSetNumbers.has(setNumberKey)) {     // Strategy 3
  // This card is truly missing, add it
}
```

## Edge Cases

### 1. Set Definition Files
TCGdex structure:
```
Scarlet & Violet/
  151.ts              ← SET FILE (not a card!)
  151/                ← Card directory
    1.ts, 2.ts, ...
```

**Fix**: Skip files that have a matching directory with the same name.

### 2. Celebrations Classic Collection #15
Four **different cards** legitimately share the same number:
- `cel25c-15_A`: Venusaur
- `cel25c-15_B`: Here Comes Team Rocket!
- `cel25c-15_C`: Rocket's Zapdos
- `cel25c-15_D`: Claydol

**Status**: Not a duplicate - keep all 4.

### 3. Black Bolt #60 Data Error
Pokemon-tcg-data has a data error:
- `zsv10pt5-60`: Escavalier #60 ✓
- `zsv10pt5-80`: Antique Cover Fossil claiming to be #60 ✗

**Status**: Source data error, cannot fix without upstream correction.

## Results

- **Started**: 2,003 duplicates
- **Eliminated**: 2,001 (99.9%)
- **Remaining**: 2 (both documented edge cases)
- **Image coverage**: 100% (every card has at least one working image URL)

## File Locations

- **Build script**: `build-multi-language.ts`
- **Helper functions**: `build-pokemon-tcg-data.ts`
- **ID normalization**: `normalizeCardId()` in build script
- **Matching logic**: `findPokemonTCGCard()` in build script
