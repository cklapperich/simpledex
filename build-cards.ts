import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Document } from 'flexsearch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SourceCard {
  id: string;
  name: string;
  number: string;
  images: {
    small: string;
    large: string;
  };
  supertype: string;
  subtypes: string[];
  types?: string[];
}

interface Set {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
}

interface MinimalCard {
  id: string;
  name: string;
  set: string;
  number: string;
  image: string;
  setNumber?: string; // Combined field for searching "Set Number"
  releaseDate: string;
  series: string;
  supertype: string;
  subtypes: string[];
  types: string[];
}

const CARDS_DIR = path.join(__dirname, 'pokemon-tcg-data', 'cards', 'en');
const SETS_FILE = path.join(__dirname, 'pokemon-tcg-data', 'sets', 'en.json');
const OUTPUT_FILE = path.join(__dirname, 'public', 'cards.json');
const INDEX_FILE = path.join(__dirname, 'public', 'search-index.json');

async function buildCards() {
  const setsData: Set[] = JSON.parse(fs.readFileSync(SETS_FILE, 'utf-8'));
  const setMap = new Map<string, Set>();
  setsData.forEach(set => setMap.set(set.id, set));

  const cardFiles = fs.readdirSync(CARDS_DIR).filter(file => file.endsWith('.json'));
  const allCards: MinimalCard[] = [];

  for (const file of cardFiles) {
    const filePath = path.join(CARDS_DIR, file);
    const cards: SourceCard[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    for (const card of cards) {
      const setId = card.id.split('-')[0];
      const setData = setMap.get(setId);
      const setName = setData?.name || setId;
      const releaseDate = setData?.releaseDate || '1999/01/09';
      const series = setData?.series || 'Unknown';

      allCards.push({
        id: card.id,
        name: card.name,
        set: setName,
        number: card.number,
        image: card.images.small,
        setNumber: `${setName} ${card.number}`, // Combined field for easier searching
        releaseDate: releaseDate,
        series: series,
        supertype: card.supertype,
        subtypes: card.subtypes || [],
        types: card.types || []
      });
    }
  }

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allCards, null, 2), 'utf-8');
  const sizeInMB = (fs.statSync(OUTPUT_FILE).size / (1024 * 1024)).toFixed(2);

  // Build FlexSearch index with better matching configuration
  const searchIndex = new Document({
    document: {
      id: 'id',
      index: [
        'name',           // Fuzzy matching for card names
        'set',            // Fuzzy matching for set names
        {
          field: 'number',
          tokenize: 'strict',  // Exact matching for numbers
          resolution: 9
        },
        {
          field: 'setNumber',
          tokenize: 'strict',  // Strict matching for "Set Number" searches
          resolution: 9
        }
      ]
    },
    tokenize: 'forward'  // Better partial matching for name/set
  });

  for (const card of allCards) {
    searchIndex.add(card);
  }

  // Export the index (FlexSearch uses callback-based export)
  const exportedIndex = await new Promise((resolve, reject) => {
    const exported: any[] = [];
    searchIndex.export((key: string, data: any) => {
      exported.push({ key, data });
    });
    // FlexSearch export is synchronous despite using callbacks
    resolve(exported);
  });

  fs.writeFileSync(INDEX_FILE, JSON.stringify(exportedIndex), 'utf-8');
  const indexSizeInMB = (fs.statSync(INDEX_FILE).size / (1024 * 1024)).toFixed(2);

  console.log(`Built ${allCards.length} cards (${sizeInMB} MB)`);
  console.log(`Built search index (${indexSizeInMB} MB)`);
}

buildCards().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
