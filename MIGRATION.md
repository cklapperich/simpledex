# Card ID Migration Guide

## Problem

When the card database was updated to use TCGdex data, the card ID format changed. Old database entries may have card IDs like:
- `base1-4` → now `base-4`
- `sv01-004` → now `sv1-4`
- `sm7.5-29` → now `sm75-29`

This causes cards in user collections/wishlists to not match up with cards in the new JSON database.

## Solution

The migration script `migrate-card-ids.ts` will:

1. **Normalize** old card IDs using the same logic as the build script
2. **Match** them against the new `cards-western.json` database
3. **Update** card IDs in both `collections` and `wishlists` tables
4. **Merge** entries when a user has both old and new versions of the same card
5. **Report** any unmatched cards that couldn't be found

## How It Works

### For Collections (with quantities)

When a user has both old and new card IDs:

```
User A:
  - base1-4 (quantity: 5)
  - base-4 (quantity: 3)  ← normalized version already exists!

Result after migration:
  - base-4 (quantity: 8)  ← merged, respecting MAX_CARD_QUANTITY of 99
```

### For Wishlists (boolean presence)

When a user has both old and new card IDs:

```
User B:
  - base1-4 (wishlisted)
  - base-4 (wishlisted)  ← normalized version already exists!

Result after migration:
  - base-4 (wishlisted)  ← duplicate removed
```

## Prerequisites

1. **Environment Variables**: Set these in your `.env` file:
   ```bash
   VITE_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   Or use:
   ```bash
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Build Cards Database**: Ensure you have the latest `cards-western.json`:
   ```bash
   npm run build:cards
   ```

## Usage

### Step 1: Dry Run (Preview Changes)

First, run the migration in dry-run mode to see what will change:

```bash
npm run migrate:dry-run
```

This will:
- Show you how many entries will be updated
- Show you how many entries will be merged
- List unmatched card IDs that couldn't be found
- **NOT make any changes to the database**

### Step 2: Execute Migration

After reviewing the dry run results, execute the migration:

```bash
npm run migrate:execute
```

This will apply all the changes to your Supabase database.

## Output Example

```
🔄 Card ID Migration Script

==================================================
⚠️  DRY RUN MODE - No changes will be made
   Run with --execute flag to apply changes
==================================================

✅ Loaded 15234 valid card IDs from cards-western.json

📦 Migrating Collections Table...

   Found 2543 total entries
   Processing 127 users

   User 12345678...:
     - Updating 45 entries
     - Merging 3 card groups
       base-4 (normal, en): 2 entries → quantity 8
       sv1-25 (normal, en): 2 entries → quantity 6
       swsh12-29 (reverse, en): 2 entries → quantity 4

   ✅ Collections Summary:
      Updated: 450
      Merged: 23
      Unmatched: 12

   ⚠️  Unmatched card IDs (12):
      - old-set-123
      - promo-XYZ
      ... and 10 more

💝 Migrating Wishlists Table...

   Found 892 total entries
   Processing 89 users

   ✅ Wishlists Summary:
      Updated: 134
      Duplicates removed: 8
      Unmatched: 5

==================================================
✅ Dry run complete! Review the changes above.
   Run with --execute to apply the migration.
==================================================
```

## What About Unmatched Cards?

If the migration reports unmatched cards, these are card IDs in your database that couldn't be found in `cards-western.json`. This could happen if:

1. **Card was removed** from the new database
2. **Card ID changed drastically** and couldn't be automatically matched
3. **Typo or invalid card ID** in the original data

You can manually investigate these by:

```sql
-- Find unmatched cards in collections
SELECT DISTINCT card_id FROM collections
WHERE card_id = 'unmatched-card-id';

-- Find unmatched cards in wishlists
SELECT DISTINCT card_id FROM wishlists
WHERE card_id = 'unmatched-card-id';
```

Consider removing these manually if they're no longer valid.

## Safety Features

- ✅ **Per-user processing**: Ensures user A's cards don't interfere with user B's
- ✅ **Respects MAX_CARD_QUANTITY**: Merged quantities capped at 99
- ✅ **Dry run by default**: Preview changes before applying
- ✅ **Preserves variation & language**: Only merges exact matches (same variation + language)
- ✅ **Service role key required**: Prevents accidental runs without proper permissions

## Rollback

If something goes wrong, you can restore from a Supabase backup. It's recommended to:

1. Take a manual backup before running the migration
2. Run the dry-run first to validate
3. Test on a staging environment if available

## Questions?

If you encounter issues:
1. Check that `cards-western.json` is up to date
2. Verify your Supabase credentials
3. Review the dry run output carefully
4. Check the unmatched cards list
