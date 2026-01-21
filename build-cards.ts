import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SourceCard {
  id: string;
  name: string;
  number: string;
  images: {
    small: string;
    large: string;
  };
}

interface Set {
  id: string;
  name: string;
}

interface MinimalCard {
  id: string;
  name: string;
  set: string;
  number: string;
  image: string;
}

const CARDS_DIR = path.join(__dirname, 'pokemon-tcg-data', 'cards', 'en');
const SETS_FILE = path.join(__dirname, 'pokemon-tcg-data', 'sets', 'en.json');
const OUTPUT_FILE = path.join(__dirname, 'public', 'cards.json');

async function buildCards() {
  const setsData: Set[] = JSON.parse(fs.readFileSync(SETS_FILE, 'utf-8'));
  const setMap = new Map<string, string>();
  setsData.forEach(set => setMap.set(set.id, set.name));

  const cardFiles = fs.readdirSync(CARDS_DIR).filter(file => file.endsWith('.json'));
  const allCards: MinimalCard[] = [];

  for (const file of cardFiles) {
    const filePath = path.join(CARDS_DIR, file);
    const cards: SourceCard[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    for (const card of cards) {
      const setId = card.id.split('-')[0];
      const setName = setMap.get(setId) || setId;

      allCards.push({
        id: card.id,
        name: card.name,
        set: setName,
        number: card.number,
        image: card.images.small
      });
    }
  }

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allCards, null, 2), 'utf-8');
  const sizeInMB = (fs.statSync(OUTPUT_FILE).size / (1024 * 1024)).toFixed(2);

  console.log(`Built ${allCards.length} cards (${sizeInMB} MB)`);
}

buildCards().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
