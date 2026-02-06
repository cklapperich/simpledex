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

const OUTPUT_DIR = path.join(__dirname, 'pikachus');
const CARDS_FILE = path.join(__dirname, 'public', 'cards-western.json');
const CONCURRENCY = 15;

/**
 * Convert tcgdex URL to high quality version
 */
function toHighResTcgdex(url: string): string {
  return url.replace('/low.webp', '/high.webp');
}

/**
 * Convert pokemontcg-io URL to high-res version
 */
function toHighRes(url: string): string {
  return url.replace(/\.png$/, '_hires.png');
}

/**
 * Get the best image URL for a card
 */
function getBestImageUrl(images: CardImage[]): string | null {
  if (!images || images.length === 0) return null;

  const ptcg = images.find(img => img.source === 'pokemontcg-io');
  if (ptcg) return toHighRes(ptcg.url);

  const tcgdex = images.find(img => img.source === 'tcgdex');
  if (tcgdex) return toHighResTcgdex(tcgdex.url);

  return null;
}

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
    } catch {
      if (attempt === retries) return false;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return false;
}

function getExtension(url: string): string {
  if (url.includes('.webp')) return '.webp';
  if (url.includes('.png')) return '.png';
  if (url.includes('.jpg') || url.includes('.jpeg')) return '.jpg';
  return '.png';
}

async function main() {
  console.log('Loading card database...');

  if (!fs.existsSync(CARDS_FILE)) {
    console.error(`Cards file not found: ${CARDS_FILE}`);
    process.exit(1);
  }

  const cards: Card[] = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'));

  // Filter for Pikachu cards
  const pikachus = cards.filter(card => {
    const englishName = card.names?.en || '';
    return englishName.toLowerCase().includes('pikachu');
  });

  console.log(`Found ${pikachus.length} Pikachu cards`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const toDownload: { card: Card; url: string; filepath: string }[] = [];

  for (const card of pikachus) {
    const url = getBestImageUrl(card.images || []);
    if (!url) continue;

    const filename = `${cardIdToFilename(card.id)}${getExtension(url)}`;
    const filepath = path.join(OUTPUT_DIR, filename);

    if (!fs.existsSync(filepath)) {
      toDownload.push({ card, url, filepath });
    }
  }

  console.log(`Downloading ${toDownload.length} images (${pikachus.length - toDownload.length} already exist)\n`);

  const limit = pLimit(CONCURRENCY);
  let completed = 0;
  let failed = 0;

  const tasks = toDownload.map(({ card, url, filepath }) =>
    limit(async () => {
      const success = await downloadImage(url, filepath);
      completed++;
      const status = success ? 'OK' : 'FAIL';
      console.log(`[${completed}/${toDownload.length}] ${status} ${card.names?.en || card.id}`);
      if (!success) failed++;
    })
  );

  await Promise.all(tasks);

  console.log(`\nDone! Downloaded: ${completed - failed}, Failed: ${failed}`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
