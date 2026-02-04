# Plan 3: Embeddings Database Build Script

## Overview
Script to generate MobileClip embeddings for all card images and store in binary format. Output hosted on Supabase Storage or CDN for client download.

---

## Output Format

### Binary Embeddings File (`embeddings.bin`)
```
Header:
  - 4 bytes: uint32 - number of cards
  - 4 bytes: uint32 - embedding dimension (512)

Per card (repeated):
  - 1 byte: uint8 - cardId string length
  - N bytes: UTF-8 cardId string
  - 2048 bytes: 512 x float32 embedding
```

**Size estimate for 20k cards:**
- Header: 8 bytes
- Per card: ~1 + 10 + 2048 = ~2059 bytes
- Total: ~41MB uncompressed
- Gzipped: ~15-25MB

---

## Files to Create

### `scripts/build-embeddings.ts`
Main build script (runs in Node.js):
```typescript
import { pipeline } from '@huggingface/transformers';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const MODEL_ID = 'Xenova/mobileclip_s2';
const BATCH_SIZE = 50;  // Process 50 cards at a time
const OUTPUT_FILE = 'embeddings.bin';

interface CardImage {
  cardId: string;
  imageUrl: string;
}

async function main() {
  // 1. Load model
  console.log('Loading MobileClip model...');
  const model = await pipeline('image-feature-extraction', MODEL_ID);

  // 2. Fetch card list with image URLs
  console.log('Fetching card list...');
  const cards = await getCardImages();
  console.log(`Found ${cards.length} cards`);

  // 3. Process in batches
  const embeddings: Map<string, Float32Array> = new Map();

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(cards.length / BATCH_SIZE)}`);

    for (const card of batch) {
      try {
        const output = await model(card.imageUrl, {
          pooling: 'mean',
          normalize: true
        });
        embeddings.set(card.cardId, new Float32Array(output.data));
      } catch (error) {
        console.error(`Failed to process ${card.cardId}:`, error);
      }
    }

    // Save checkpoint every 10 batches
    if ((i / BATCH_SIZE) % 10 === 0) {
      await saveCheckpoint(embeddings);
    }
  }

  // 4. Write binary output
  console.log('Writing binary file...');
  await writeBinaryEmbeddings(embeddings, OUTPUT_FILE);

  // 5. Upload to Supabase Storage
  console.log('Uploading to Supabase...');
  await uploadToSupabase(OUTPUT_FILE);

  console.log('Done!');
}

async function getCardImages(): Promise<CardImage[]> {
  // Load from cards-western.json
  const cardsJson = JSON.parse(fs.readFileSync('public/cards-western.json', 'utf-8'));

  return cardsJson
    .filter((card: any) => card.images?.length > 0)
    .map((card: any) => ({
      cardId: card.id,
      imageUrl: card.images[0].url  // Primary image
    }));
}

function writeBinaryEmbeddings(
  embeddings: Map<string, Float32Array>,
  outputPath: string
): void {
  const cardIds = Array.from(embeddings.keys());
  const dim = 512;

  // Calculate total size
  let totalSize = 8; // header
  for (const cardId of cardIds) {
    totalSize += 1 + cardId.length + (dim * 4);
  }

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  // Write header
  buffer.writeUInt32LE(cardIds.length, offset); offset += 4;
  buffer.writeUInt32LE(dim, offset); offset += 4;

  // Write each card
  for (const cardId of cardIds) {
    const embedding = embeddings.get(cardId)!;

    // CardId length + string
    buffer.writeUInt8(cardId.length, offset); offset += 1;
    buffer.write(cardId, offset, 'utf-8'); offset += cardId.length;

    // Embedding floats
    for (let i = 0; i < dim; i++) {
      buffer.writeFloatLE(embedding[i], offset); offset += 4;
    }
  }

  fs.writeFileSync(outputPath, buffer);
  console.log(`Wrote ${outputPath}: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
}

async function uploadToSupabase(filePath: string): Promise<void> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const fileBuffer = fs.readFileSync(filePath);

  const { error } = await supabase.storage
    .from('scanner')
    .upload('embeddings.bin', fileBuffer, {
      contentType: 'application/octet-stream',
      upsert: true
    });

  if (error) throw error;

  // Get public URL
  const { data } = supabase.storage.from('scanner').getPublicUrl('embeddings.bin');
  console.log(`Uploaded to: ${data.publicUrl}`);
}

async function saveCheckpoint(embeddings: Map<string, Float32Array>): Promise<void> {
  // Save as JSON for recovery
  const checkpoint = Object.fromEntries(
    Array.from(embeddings.entries()).map(([k, v]) => [k, Array.from(v)])
  );
  fs.writeFileSync('embeddings-checkpoint.json', JSON.stringify(checkpoint));
  console.log(`Checkpoint saved: ${embeddings.size} cards`);
}

main().catch(console.error);
```

### `scripts/resume-embeddings.ts`
Resume from checkpoint if interrupted:
```typescript
// Load checkpoint and continue from where we left off
async function resume() {
  const checkpoint = JSON.parse(fs.readFileSync('embeddings-checkpoint.json', 'utf-8'));
  const processed = new Set(Object.keys(checkpoint));

  // ... continue with unprocessed cards
}
```

### `scripts/verify-embeddings.ts`
Verify embeddings quality:
```typescript
// Test similarity search with known cards
async function verify() {
  const embeddings = loadBinaryEmbeddings('embeddings.bin');

  // Test: Same card image should match itself
  // Test: Similar cards (same Pokemon) should score high
  // Test: Different cards should score low
}
```

---

## Supabase Storage Setup

### Create Storage Bucket
```sql
-- In Supabase SQL editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('scanner', 'scanner', true);

-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'scanner');
```

### Update Client Config
```typescript
// In src/services/scanner/embeddings.ts
const EMBEDDINGS_URL = 'https://YOUR_PROJECT.supabase.co/storage/v1/object/public/scanner/embeddings.bin';
```

---

## Alternative: Static File Hosting

If Supabase Storage has bandwidth limits, host on:
- Cloudflare R2 (free egress)
- GitHub Releases (for versioning)
- Vercel/Netlify (if deployed there)

---

## Running the Script

```bash
# Install dependencies
npm install @huggingface/transformers @supabase/supabase-js

# Set environment variables
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-key"

# Run build (may take several hours for 20k cards)
npx tsx scripts/build-embeddings.ts

# Or run in background with logging
nohup npx tsx scripts/build-embeddings.ts > embeddings-build.log 2>&1 &
```

---

## Incremental Updates

When new cards are added:
```typescript
// scripts/update-embeddings.ts
async function updateEmbeddings() {
  // 1. Load existing embeddings
  const existing = loadBinaryEmbeddings('embeddings.bin');
  const existingIds = new Set(existing.cardIds);

  // 2. Find new cards
  const allCards = await getCardImages();
  const newCards = allCards.filter(c => !existingIds.has(c.cardId));

  // 3. Generate embeddings for new cards only
  // 4. Merge and rewrite binary file
  // 5. Upload to Supabase
}
```

---

## Verification

1. Script runs without errors
2. Binary file is correct size (~40MB for 20k cards)
3. File uploads to Supabase Storage
4. Public URL is accessible
5. Client can download and parse correctly
6. Similarity search returns sensible results
