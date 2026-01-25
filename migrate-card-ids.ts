import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { normalizeCardId } from './src/utils/cardIdUtils.js';

// Load environment variables from .env file
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('   Set VITE_SUPABASE_URL or SUPABASE_URL for the URL');
  console.error('   Set SUPABASE_SERVICE_ROLE_KEY for the service role key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const MAX_CARD_QUANTITY = 99;

/**
 * Migrate collections_migrated table - normalize all card IDs (idempotent)
 */
async function migrateCollections(dryRun: boolean = true) {
  console.log('\n📦 Migrating collections_migrated Table...\n');

  // Fetch all collection entries from collections_migrated
  const { data: allEntries, error } = await supabase
    .from('collections_migrated')
    .select('id, user_id, card_id, variation, quantity, language, created_at');

  if (error) {
    console.error('❌ Error fetching collections_migrated:', error);
    return;
  }

  if (!allEntries || allEntries.length === 0) {
    console.log('   No entries found in collections_migrated table.');
    return;
  }

  console.log(`   Found ${allEntries.length} total entries to process`);

  // Check if any normalization is needed
  const needsNormalization = allEntries.some(e => e.card_id !== normalizeCardId(e.card_id));

  if (!needsNormalization) {
    console.log('   ✅ All entries are already normalized and deduplicated!');
    return;
  }

  // Group by user_id for per-user processing
  const allUserEntries = new Map<string, typeof allEntries>();

  for (const entry of allEntries) {
    if (!allUserEntries.has(entry.user_id)) {
      allUserEntries.set(entry.user_id, []);
    }
    allUserEntries.get(entry.user_id)!.push(entry);
  }

  console.log(`   Processing ${allUserEntries.size} users\n`);

  let totalProcessed = 0;
  let totalMerged = 0;
  const migratedEntries: Array<{
    user_id: string;
    card_id: string;
    variation: string;
    quantity: number;
    language: string;
    created_at: string;
  }> = [];

  for (const [userId, thisUserEntries] of allUserEntries.entries()) {
    // Group all entries by their normalized ID + variation + language
    const normalizedGroups = new Map<string, typeof allEntries>();

    for (const entry of thisUserEntries) {
      const normalizedId = normalizeCardId(entry.card_id);
      const groupKey = `${normalizedId}|${entry.variation}|${entry.language}`;

      if (!normalizedGroups.has(groupKey)) {
        normalizedGroups.set(groupKey, []);
      }
      normalizedGroups.get(groupKey)!.push(entry);
    }

    // Process each group
    let userMerged = 0;
    for (const [groupKey, groupEntries] of normalizedGroups.entries()) {
      const [normalizedId, variation, language] = groupKey.split('|');

      if (groupEntries.length > 1) {
        // Multiple entries need to be merged
        const totalQuantity = Math.min(
          MAX_CARD_QUANTITY,
          groupEntries.reduce((sum, e) => sum + e.quantity, 0)
        );

        // Use the earliest created_at
        const oldestEntry = groupEntries.reduce((oldest, entry) =>
          entry.created_at < oldest.created_at ? entry : oldest
        );

        migratedEntries.push({
          user_id: userId,
          card_id: normalizedId,
          variation,
          quantity: totalQuantity,
          language,
          created_at: oldestEntry.created_at
        });

        userMerged++;
        console.log(`   User ${userId.substring(0, 8)}...:`);
        console.log(`     - Merged ${groupEntries.length} entries for ${normalizedId} (${variation}, ${language}) → quantity ${totalQuantity}`);
      } else {
        // Single entry, just normalize the card ID
        const entry = groupEntries[0];
        migratedEntries.push({
          user_id: userId,
          card_id: normalizedId,
          variation: entry.variation,
          quantity: entry.quantity,
          language: entry.language,
          created_at: entry.created_at
        });
      }
    }

    totalProcessed += normalizedGroups.size;
    totalMerged += userMerged;
  }

  // Replace all entries in collections_migrated with normalized ones
  if (!dryRun && migratedEntries.length > 0) {
    console.log(`\n   Clearing collections_migrated table...`);

    // Delete all existing entries
    const { error: deleteError } = await supabase
      .from('collections_migrated')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (deleteError) {
      console.error(`   ❌ Error clearing table:`, deleteError);
      return;
    }

    console.log(`   ✅ Table cleared`);
    console.log(`\n   Inserting ${migratedEntries.length} normalized entries...`);

    // Insert in batches of 1000 to avoid timeout
    const batchSize = 1000;
    for (let i = 0; i < migratedEntries.length; i += batchSize) {
      const batch = migratedEntries.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('collections_migrated')
        .insert(batch);

      if (insertError) {
        console.error(`       ❌ Error inserting batch ${i / batchSize + 1}:`, insertError);
      } else {
        console.log(`       ✅ Inserted batch ${i / batchSize + 1} (${batch.length} entries)`);
      }
    }
  }

  console.log(`\n   ✅ Collections Summary:`);
  console.log(`      Total entries migrated: ${totalProcessed}`);
  console.log(`      Entries merged: ${totalMerged}`);
  console.log(`      Original entries: ${allEntries.length}`);
}

/**
 * Migrate wishlists table - normalize all card IDs
 */
async function migrateWishlists(dryRun: boolean = true) {
  console.log('\n💝 Migrating Wishlists Table...\n');

  // Fetch all wishlist entries
  const { data: allEntries, error } = await supabase
    .from('wishlists')
    .select('id, user_id, card_id, variation, language');

  if (error) {
    console.error('❌ Error fetching wishlists:', error);
    return;
  }

  if (!allEntries || allEntries.length === 0) {
    console.log('   No entries found in wishlists table.');
    return;
  }

  // Filter to only entries that need normalization
  const entries = allEntries.filter(e => e.card_id !== normalizeCardId(e.card_id));

  if (entries.length === 0) {
    console.log(`   All ${allEntries.length} entries are already normalized. Nothing to do.`);
    return;
  }

  console.log(`   Found ${allEntries.length} total entries, ${entries.length} need normalization`);

  // Group by user_id for per-user processing
  const userEntries = new Map<string, typeof entries>();
  const allUserEntries = new Map<string, typeof allEntries>();

  for (const entry of entries) {
    if (!userEntries.has(entry.user_id)) {
      userEntries.set(entry.user_id, []);
    }
    userEntries.get(entry.user_id)!.push(entry);
  }

  for (const entry of allEntries) {
    if (!allUserEntries.has(entry.user_id)) {
      allUserEntries.set(entry.user_id, []);
    }
    allUserEntries.get(entry.user_id)!.push(entry);
  }

  console.log(`   Processing ${userEntries.size} users\n`);

  let totalUpdated = 0;
  let totalDuplicates = 0;

  for (const [userId, thisUserEntries] of userEntries.entries()) {
    const toDelete: string[] = [];
    const toUpdate: Array<{ id: string; newCardId: string }> = [];
    const duplicates: Set<string> = new Set();

    const allThisUserEntries = allUserEntries.get(userId) || [];

    // First pass: group all entries by their normalized ID + variation + language
    const normalizedGroups = new Map<string, typeof entries>();

    for (const entry of thisUserEntries) {
      const normalizedId = normalizeCardId(entry.card_id);
      const groupKey = `${normalizedId}|${entry.variation}|${entry.language}`;

      if (!normalizedGroups.has(groupKey)) {
        normalizedGroups.set(groupKey, []);
      }
      normalizedGroups.get(groupKey)!.push(entry);
    }

    // Second pass: determine what to do with each group
    for (const [groupKey, groupEntries] of normalizedGroups.entries()) {
      const [normalizedId, variation, language] = groupKey.split('|');

      // Check if user already has an entry with the normalized ID (already normalized)
      const existingNormalized = allThisUserEntries.find(e =>
        e.card_id === normalizedId &&
        e.variation === variation &&
        e.language === language
      );

      if (existingNormalized || groupEntries.length > 1) {
        // Duplicate(s) exist - keep one, delete the rest
        const allEntries = existingNormalized ? [existingNormalized, ...groupEntries] : groupEntries;
        const targetEntry = existingNormalized || groupEntries[0];

        duplicates.add(normalizedId);

        // Mark all non-target entries for deletion
        for (const entry of allEntries) {
          if (entry.id !== targetEntry.id) {
            toDelete.push(entry.id);
          }
        }

        // If target wasn't already normalized, update it
        if (targetEntry.card_id !== normalizedId) {
          toUpdate.push({ id: targetEntry.id, newCardId: normalizedId });
        }
      } else {
        // Simple update - only one entry needs normalization
        toUpdate.push({ id: groupEntries[0].id, newCardId: normalizedId });
      }
    }

    // Execute updates
    if (toUpdate.length > 0) {
      console.log(`   User ${userId.substring(0, 8)}...:`);
      console.log(`     - Updating ${toUpdate.length} entries`);

      if (!dryRun) {
        for (const { id, newCardId } of toUpdate) {
          const { error } = await supabase
            .from('wishlists')
            .update({ card_id: newCardId })
            .eq('id', id);

          if (error) {
            console.error(`       ❌ Error updating entry ${id}:`, error);
          }
        }
      }
      totalUpdated += toUpdate.length;
    }

    // Handle duplicates
    if (duplicates.size > 0) {
      console.log(`   User ${userId.substring(0, 8)}...:`);
      console.log(`     - Removing ${duplicates.size} duplicate entries`);
      totalDuplicates += duplicates.size;
    }

    // Delete old entries
    if (toDelete.length > 0 && !dryRun) {
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .in('id', toDelete);

      if (error) {
        console.error(`     ❌ Error deleting old entries:`, error);
      }
    }
  }

  console.log(`\n   ✅ Wishlists Summary:`);
  console.log(`      Updated: ${totalUpdated}`);
  console.log(`      Duplicates removed: ${totalDuplicates}`);
}

/**
 * Main migration function
 */
async function migrate() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  console.log('🔄 Card ID Normalization Migration\n');
  console.log('=' .repeat(50));

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
    console.log('   Run with --execute flag to apply changes');
  } else {
    console.log('⚡ EXECUTE MODE - Changes will be applied!');
  }
  console.log('=' .repeat(50));

  // Migrate both tables
  await migrateCollections(dryRun);
  await migrateWishlists(dryRun);

  console.log('\n' + '='.repeat(50));
  if (dryRun) {
    console.log('✅ Dry run complete! Review the changes above.');
    console.log('   Run with --execute to apply the migration.');
  } else {
    console.log('✅ Migration complete!');
    console.log('   All card IDs have been normalized.');
  }
  console.log('=' .repeat(50) + '\n');
}

migrate().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
