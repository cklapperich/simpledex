import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import { cardIdToFilename } from './src/utils/cardIdUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CardImage {
  url: string;
  source: 'tcgdex' | 'pokemontcg-io';
  size?: string;
}

interface Card {
  id: string;
  names: Record<string, string>;
  set: string;
  number: string;
  images?: CardImage[];
}

const OUTPUT_DIR = path.join(__dirname, 'card-images');
const CARDS_FILE = path.join(__dirname, 'public', 'cards-western.json');
const CONCURRENCY = 15; // parallel downloads
const PROGRESS_INTERVAL = 100; // log progress every N completions

/**
 * Convert tcgdex URL to high quality version
 */
function toHighResTcgdex(url: string): string {
  // Convert low quality to high quality
  return url.replace('/low.webp', '/high.webp');
}

/**
 * Convert pokemontcg-io URL to high-res version
 * https://images.pokemontcg.io/xy11/99.png -> https://images.pokemontcg.io/xy11/99_hires.png
 */
function toHighRes(url: string): string {
  return url.replace(/\.png$/, '_hires.png');
}

/**
 * Get the best image URL for a card
 * Prefers: pokemontcg-io (converted to hires) > tcgdex high
 */
function getBestImageUrl(images: CardImage[]): string | null {
  if (!images || images.length === 0) return null;

  // First: any pokemontcg-io (convert to high-res)
  const ptcg = images.find(img => img.source === 'pokemontcg-io');
  if (ptcg) return toHighRes(ptcg.url);

  // Fallback: tcgdex (convert to high quality URL)
  const tcgdex = images.find(img => img.source === 'tcgdex');
  if (tcgdex) return toHighResTcgdex(tcgdex.url);

  return null;
}

/**
 * Download an image and save it to disk with retries
 */
async function downloadImage(url: string, filepath: string, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (attempt === retries) return false;
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filepath, Buffer.from(buffer));
      return true;
    } catch (error) {
      if (attempt === retries) return false;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return false;
}

/**
 * Get file extension from URL
 */
function getExtension(url: string): string {
  if (url.includes('.webp')) return '.webp';
  if (url.includes('.png')) return '.png';
  if (url.includes('.jpg') || url.includes('.jpeg')) return '.jpg';
  return '.png';
}


function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

async function main() {
  console.log('🔍 Loading card database...');

  if (!fs.existsSync(CARDS_FILE)) {
    console.error(`❌ Cards file not found: ${CARDS_FILE}`);
    process.exit(1);
  }

  const cards: Card[] = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'));
  console.log(`   Loaded ${cards.length} cards`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Check which cards need downloading
  const toDownload: { card: Card; url: string; filepath: string }[] = [];
  let noImage = 0;

  for (const card of cards) {
    const url = getBestImageUrl(card.images || []);
    if (!url) {
      noImage++;
      continue;
    }

    const filename = `${cardIdToFilename(card.id)}${getExtension(url)}`;
    const filepath = path.join(OUTPUT_DIR, filename);

    if (!fs.existsSync(filepath)) {
      toDownload.push({ card, url, filepath });
    }
  }

  const existing = cards.length - toDownload.length - noImage;
  console.log(`\n📊 Summary:`);
  console.log(`   Total cards: ${cards.length}`);
  console.log(`   Already downloaded: ${existing}`);
  console.log(`   No image available: ${noImage}`);
  console.log(`   To download: ${toDownload.length}`);
  console.log(`\n📥 Starting download with ${CONCURRENCY} parallel connections...\n`);

  const limit = pLimit(CONCURRENCY);
  let completed = 0;
  let failed = 0;
  const failedCards: string[] = [];
  const startTime = Date.now();

  const tasks = toDownload.map(({ card, url, filepath }) =>
    limit(async () => {
      const success = await downloadImage(url, filepath);
      completed++;

      if (!success) {
        failed++;
        failedCards.push(card.id);
      }

      // Progress logging
      if (completed % PROGRESS_INTERVAL === 0 || completed === toDownload.length) {
        const pct = ((completed / toDownload.length) * 100).toFixed(1);
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = completed / elapsed;
        const remaining = (toDownload.length - completed) / rate;
        console.log(`[${pct}%] ${completed}/${toDownload.length} | ${rate.toFixed(1)}/s | ETA: ${formatTime(remaining)} | Failed: ${failed}`);
      }
    })
  );

  await Promise.all(tasks);

  const totalTime = (Date.now() - startTime) / 1000;

  console.log(`\n✅ Done in ${formatTime(totalTime)}!`);
  console.log(`   Downloaded: ${completed - failed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Output: ${OUTPUT_DIR}`);

  if (failedCards.length > 0 && failedCards.length <= 20) {
    console.log(`\n❌ Failed cards:`);
    failedCards.forEach(id => console.log(`   - ${id}`));
  } else if (failedCards.length > 20) {
    console.log(`\n❌ Failed cards (first 20):`);
    failedCards.slice(0, 20).forEach(id => console.log(`   - ${id}`));
    console.log(`   ... and ${failedCards.length - 20} more`);
  }
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
