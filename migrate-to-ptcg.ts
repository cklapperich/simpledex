/**
 * migrate-to-ptcg.ts — Migrate ~309 card IDs from old normalized form to native ptcg-data IDs.
 *
 * Affected sets (where normalizeCardId stripped a suffix):
 *   swsh9-TG01   -> swsh9tg-TG01    (Brilliant Stars TG, 30 cards)
 *   swsh10-TG01  -> swsh10tg-TG01   (Astral Radiance TG, 30 cards)
 *   swsh11-TG01  -> swsh11tg-TG01   (Lost Origin TG, 30 cards)
 *   swsh12-TG01  -> swsh12tg-TG01   (Silver Tempest TG, 30 cards)
 *   swsh125-GG01 -> swsh12pt5gg-GG01 (Crown Zenith GG, 70 cards)
 *   swsh45-SH01  -> swsh45sv-SH01   (Shining Fates SV, 94 cards)
 *   cel25-25     -> cel25c-25        (Celebrations Classic, 25 cards)
 *
 * Usage:
 *   tsx migrate-to-ptcg.ts            # dry run (safe, no changes)
 *   tsx migrate-to-ptcg.ts --execute  # apply changes
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { normalizeCardId } from './src/utils/cardIdUtils.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_FILE = path.join(__dirname, 'public', 'cards-western.json');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const dryRun = !process.argv.includes('--execute');

// ---------------------------------------------------------------------------
// Build old->new ID mapping from public/cards-western.json
// ---------------------------------------------------------------------------

function buildIdMapping(): Map<string, string> {
  if (!fs.existsSync(CARDS_FILE)) {
    console.error(`❌ ${CARDS_FILE} not found. Run build-ptcg.ts first.`);
    process.exit(1);
  }

  const cards: Array<{ id: string }> = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'));
  const mapping = new Map<string, string>(); // oldId -> newId

  for (const card of cards) {
    const newId = card.id;
    const oldId = normalizeCardId(newId);
    if (oldId !== newId) {
      mapping.set(oldId, newId);
    }
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// Migrate a flat table with a card_id column
// ---------------------------------------------------------------------------

type FlatRow = { id: string; user_id: string; card_id: string; variation: string | null; language: string | null };

// Composite key matching the unique constraint (user_id, card_id, variation, language)
function rowKey(cardId: string, variation: string | null, language: string | null): string {
  return `${cardId}|${variation ?? ''}|${language ?? ''}`;
}

async function fetchAllRows(tableName: string): Promise<{ rows: FlatRow[] | null; error: { code?: string; message: string } | null }> {
  const PAGE_SIZE = 1000;
  const all: FlatRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('id, user_id, card_id, variation, language')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) return { rows: null, error };
    if (!data || data.length === 0) break;
    all.push(...(data as FlatRow[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { rows: all, error: null };
}

async function migrateCardIdTable(
  tableName: string,
  mapping: Map<string, string>,
) {
  console.log(`\n📦 ${tableName}...`);

  const { rows, error } = await fetchAllRows(tableName);

  if (error) {
    if (error.code === '42P01') {
      console.log(`   Table does not exist, skipping.`);
      return { updated: 0, deduped: 0, warnings: 0 };
    }
    console.error(`   ❌ Error fetching ${tableName}:`, error.message);
    return { updated: 0, deduped: 0, warnings: 0 };
  }

  if (!rows || rows.length === 0) {
    console.log(`   Empty table.`);
    return { updated: 0, deduped: 0, warnings: 0 };
  }

  // Find rows that need migration
  const toMigrate = rows.filter(r => mapping.has(r.card_id));

  if (toMigrate.length === 0) {
    console.log(`   ✅ All ${rows.length} rows already up-to-date.`);
    return { updated: 0, deduped: 0, warnings: 0 };
  }

  console.log(`   ${rows.length} total rows, ${toMigrate.length} need migration`);

  // Build composite key set per user matching the unique constraint (card_id, variation, language)
  const userKeys = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!userKeys.has(row.user_id)) userKeys.set(row.user_id, new Set());
    userKeys.get(row.user_id)!.add(rowKey(row.card_id, row.variation, row.language));
  }

  let updated = 0;
  let deduped = 0;
  let warnings = 0;

  for (const row of toMigrate) {
    const newId = mapping.get(row.card_id)!;
    const userKeySet = userKeys.get(row.user_id)!;
    const newKey = rowKey(newId, row.variation, row.language);

    if (userKeySet.has(newKey)) {
      // Collision: user already has a row with this (newId, variation, language) — delete the old-ID row
      console.log(`   ⚠️  Dedup: user ${row.user_id.slice(0, 8)}… ${row.card_id} -> ${newId} (already exists, deleting old)`);
      if (!dryRun) {
        const { error: delErr } = await supabase.from(tableName).delete().eq('id', row.id);
        if (delErr) {
          console.error(`   ❌ Delete failed for row ${row.id}:`, delErr.message);
          warnings++;
          continue;
        }
      }
      deduped++;
    } else {
      // Normal update — mark new key as taken so subsequent rows with same (newId, variation, language) go to dedup
      userKeySet.add(newKey);
      if (!dryRun) {
        const { error: upErr } = await supabase
          .from(tableName)
          .update({ card_id: newId })
          .eq('id', row.id);
        if (upErr) {
          console.error(`   ❌ Update failed for row ${row.id}:`, upErr.message);
          warnings++;
          continue;
        }
      } else {
        console.log(`   [dry] ${row.card_id} -> ${newId}`);
      }
      updated++;
    }
  }

  console.log(`   Updated: ${updated}, Deduped: ${deduped}, Warnings: ${warnings}`);
  return { updated, deduped, warnings };
}

// ---------------------------------------------------------------------------
// Migrate decks table (cards stored as JSONB object with card IDs as keys)
// ---------------------------------------------------------------------------

async function migrateDecks(mapping: Map<string, string>) {
  console.log(`\n🃏 decks...`);

  const { data: decks, error } = await supabase
    .from('decks')
    .select('id, cards');

  if (error) {
    if ((error as { code?: string }).code === '42P01') {
      console.log(`   Table does not exist, skipping.`);
      return { updated: 0, warnings: 0 };
    }
    console.error('   ❌ Error fetching decks:', error.message);
    return { updated: 0, warnings: 0 };
  }

  if (!decks || decks.length === 0) {
    console.log('   Empty table.');
    return { updated: 0, warnings: 0 };
  }

  let updated = 0;
  let warnings = 0;

  for (const deck of decks) {
    if (!deck.cards || typeof deck.cards !== 'object') continue;

    const oldCards: Record<string, number> = deck.cards;
    const needsMigration = Object.keys(oldCards).some(k => mapping.has(k));
    if (!needsMigration) continue;

    // Remap keys
    const newCards: Record<string, number> = {};
    for (const [cardId, qty] of Object.entries(oldCards)) {
      const newId = mapping.get(cardId) ?? cardId;
      if (newId in newCards) {
        // Merge quantities if collision (shouldn't happen in practice)
        newCards[newId] = (newCards[newId] || 0) + (qty as number);
        console.log(`   ⚠️  Deck ${deck.id}: merged duplicate ${cardId} -> ${newId}`);
      } else {
        newCards[newId] = qty as number;
      }
      if (newId !== cardId) {
        console.log(`   [${dryRun ? 'dry' : 'exec'}] deck ${deck.id}: ${cardId} -> ${newId}`);
      }
    }

    if (!dryRun) {
      const { error: upErr } = await supabase
        .from('decks')
        .update({ cards: newCards })
        .eq('id', deck.id);
      if (upErr) {
        console.error(`   ❌ Update failed for deck ${deck.id}:`, upErr.message);
        warnings++;
        continue;
      }
    }

    updated++;
  }

  console.log(`   Decks updated: ${updated}, Warnings: ${warnings}`);
  return { updated, warnings };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🔄 migrate-to-ptcg.ts');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (pass --execute to apply)' : 'EXECUTE'}\n`);

  const mapping = buildIdMapping();
  console.log(`📋 ID mapping: ${mapping.size} old IDs -> new IDs`);

  if (mapping.size === 0) {
    console.log('   Nothing to migrate.');
    return;
  }

  // Show sample of what's in scope
  let shown = 0;
  for (const [oldId, newId] of mapping) {
    if (shown++ >= 5) { console.log('   ...'); break; }
    console.log(`   ${oldId} -> ${newId}`);
  }

  const r1 = await migrateCardIdTable('collections', mapping);
  const r2 = await migrateCardIdTable('collections_migrated', mapping);
  const r3 = await migrateCardIdTable('wishlists', mapping);
  const r4 = await migrateDecks(mapping);

  const totalUpdated = r1.updated + r2.updated + r3.updated + r4.updated;
  const totalDeduped = (r1.deduped ?? 0) + (r2.deduped ?? 0) + (r3.deduped ?? 0);
  const totalWarnings = r1.warnings + r2.warnings + r3.warnings + r4.warnings;

  console.log('\n─────────────────────────────');
  console.log(`✅ Done.  Updated: ${totalUpdated}  Deduped: ${totalDeduped}  Warnings: ${totalWarnings}`);
  if (dryRun) {
    console.log('   (dry run — no changes made)');
  }
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
