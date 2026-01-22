import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TCGDEX_BASE_DIR = path.join(__dirname, 'cards-database-2.41.1');
const WESTERN_DATA_DIR = path.join(TCGDEX_BASE_DIR, 'data');
const ASIAN_DATA_DIR = path.join(TCGDEX_BASE_DIR, 'data-asia');
const OUTPUT_DIR = path.join(__dirname, 'public');

// Language definitions
const WESTERN_LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt', 'pt-br', 'pt-pt', 'nl', 'pl', 'ru'];
const ASIAN_LANGUAGES = ['ja', 'ko', 'zh-tw', 'zh-cn', 'id', 'th'];

interface MultiLangCard {
  id: string;
  names: Record<string, string>; // Multi-language names
  set: string;
  number: string;
  setNumber?: string;
  releaseDate: string;
  series: string;
  supertype: string;
  subtypes: string[];
  types: string[];
  ptcgoCode?: string;
  rarity: string;
  hp?: number;
  attacks?: Array<{
    name: string;
    cost: string[];
    damage?: string;
    effect?: string;
  }>;
  abilities?: Array<{
    name: string;
    effect: string;
    type: string;
  }>;
  weaknesses?: Array<{
    type: string;
    value?: string;
  }>;
  resistances?: Array<{
    type: string;
    value?: string;
  }>;
  retreatCost?: string[];
  seriesId?: string;
  setId?: string;
}

/**
 * Extract multi-language names from card file content
 */
function extractNames(fileContent: string, expectedLanguages: string[]): Record<string, string> {
  const names: Record<string, string> = {};

  // Match the name object: name: { en: "...", fr: "...", ... }
  const nameBlockMatch = fileContent.match(/name:\s*{([^}]+)}/);
  if (!nameBlockMatch) return names;

  const nameBlock = nameBlockMatch[1];

  // Extract each language's name
  for (const lang of expectedLanguages) {
    // Match patterns like: en: "Card Name" or ja: "カード名"
    const langMatch = nameBlock.match(new RegExp(`${lang}:\\s*"([^"]+)"`));
    if (langMatch) {
      names[lang] = langMatch[1];
    }
  }

  return names;
}

/**
 * Extract attack data (use English or first available language for names/effects)
 */
function extractAttacks(fileContent: string, primaryLang: string): Array<{
  name: string;
  cost: string[];
  damage?: string;
  effect?: string;
}> | undefined {
  const attacks: Array<{ name: string; cost: string[]; damage?: string; effect?: string }> = [];

  const attacksMatch = fileContent.match(/attacks:\s*\[([\s\S]*?)\]/);
  if (!attacksMatch) return undefined;

  const attacksStr = attacksMatch[1];

  // Split by attack objects (each attack is separated by }, {)
  const attackBlocks = attacksStr.split(/}\s*,\s*{/).map((block, idx, arr) => {
    if (idx === 0) return block + '}';
    if (idx === arr.length - 1) return '{' + block;
    return '{' + block + '}';
  });

  for (const attackBlock of attackBlocks) {
    // Extract attack name (try primary language first, then any language)
    const attackNameMatch = attackBlock.match(new RegExp(`name:\\s*{[^}]*${primaryLang}:\\s*"([^"]+)"`)) ||
                           attackBlock.match(/name:\s*{[^}]*:\s*"([^"]+)"/);

    if (!attackNameMatch) continue;

    // Extract cost
    const costMatch = attackBlock.match(/cost:\s*\[([\s\S]*?)\]/);
    const cost: string[] = [];
    if (costMatch) {
      const costMatches = costMatch[1].match(/"([^"]+)"/g);
      if (costMatches) {
        cost.push(...costMatches.map(c => c.replace(/"/g, '')));
      }
    }

    // Extract damage
    const damageMatch = attackBlock.match(/damage:\s*(\d+|"[^"]*")/);
    const damage = damageMatch ? damageMatch[1].replace(/"/g, '') : undefined;

    // Extract effect
    const effectMatch = attackBlock.match(new RegExp(`effect:\\s*{[^}]*${primaryLang}:\\s*"([^"]+)"`)) ||
                       attackBlock.match(/effect:\s*{[^}]*:\s*"([^"]+)"/);
    const effect = effectMatch ? effectMatch[1] : undefined;

    attacks.push({
      name: attackNameMatch[1],
      cost,
      damage,
      effect
    });
  }

  return attacks.length > 0 ? attacks : undefined;
}

/**
 * Extract ability data (use English or first available language)
 */
function extractAbilities(fileContent: string, primaryLang: string): Array<{
  name: string;
  effect: string;
  type: string;
}> | undefined {
  const abilities: Array<{ name: string; effect: string; type: string }> = [];

  const abilitiesMatch = fileContent.match(/abilities:\s*\[([\s\S]*?)\]/);
  if (!abilitiesMatch) return undefined;

  const abilitiesStr = abilitiesMatch[1];

  // Extract ability name
  const abilityNameMatch = abilitiesStr.match(new RegExp(`name:\\s*{[^}]*${primaryLang}:\\s*"([^"]+)"`)) ||
                          abilitiesStr.match(/name:\s*{[^}]*:\s*"([^"]+)"/);

  // Extract ability effect
  const abilityEffectMatch = abilitiesStr.match(new RegExp(`effect:\\s*{[^}]*${primaryLang}:\\s*"([^"]+)"`)) ||
                            abilitiesStr.match(/effect:\s*{[^}]*:\s*"([^"]+)"/);

  // Extract ability type
  const abilityTypeMatch = abilitiesStr.match(/type:\s*"([^"]+)"/);

  if (abilityNameMatch && abilityEffectMatch && abilityTypeMatch) {
    abilities.push({
      name: abilityNameMatch[1],
      effect: abilityEffectMatch[1],
      type: abilityTypeMatch[1]
    });
  }

  return abilities.length > 0 ? abilities : undefined;
}

/**
 * Process a directory of card files
 */
async function processDirectory(
  dataDir: string,
  expectedLanguages: string[],
  primaryLang: string,
  datasetName: string
): Promise<MultiLangCard[]> {
  console.log(`\nProcessing ${datasetName} cards from: ${dataDir}`);

  const cardFiles = await glob('**/*.ts', {
    cwd: dataDir,
    ignore: ['**/*.test.ts', '**/index.ts'],
    absolute: true
  });

  console.log(`Found ${cardFiles.length} files`);

  const cards: MultiLangCard[] = [];
  let processedCards = 0;
  let skippedCards = 0;

  for (const cardFile of cardFiles) {
    try {
      const fileName = path.basename(cardFile);

      // Only process files that are card numbers (e.g., "1.ts", "25.ts", "100.ts")
      if (!/^\d+\.ts$/.test(fileName)) {
        skippedCards++;
        continue;
      }

      // Read card file
      const fileContent = fs.readFileSync(cardFile, 'utf-8');

      // Extract names for all available languages
      const names = extractNames(fileContent, expectedLanguages);

      // Skip cards with no names in expected languages
      if (Object.keys(names).length === 0) {
        skippedCards++;
        continue;
      }

      // Get card metadata from file path
      const pathParts = cardFile.split('/');
      const setName = pathParts[pathParts.length - 2];
      const seriesName = pathParts[pathParts.length - 3];
      const cardNumber = fileName.replace('.ts', '');

      // Get series ID
      const seriesFilePath = path.join(path.dirname(cardFile), `../../${seriesName}.ts`);
      let seriesId = seriesName.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (fs.existsSync(seriesFilePath)) {
        const seriesContent = fs.readFileSync(seriesFilePath, 'utf-8');
        const seriesIdMatch = seriesContent.match(/id:\s*"([^"]+)"/);
        if (seriesIdMatch) seriesId = seriesIdMatch[1];
      }

      // Get set ID and metadata
      const setFilePath = path.join(path.dirname(cardFile), `../${setName}.ts`);
      let setId = setName.toLowerCase().replace(/[^a-z0-9]/g, '');
      let releaseDate = '1999/01/09';
      let ptcgoCode = '';

      if (fs.existsSync(setFilePath)) {
        const setContent = fs.readFileSync(setFilePath, 'utf-8');
        const setIdMatch = setContent.match(/id:\s*"([^"]+)"/);
        const releaseDateMatch = setContent.match(/releaseDate:\s*"([^"]+)"/);
        const tcgOnlineMatch = setContent.match(/tcgOnline:\s*"([^"]+)"/);

        if (setIdMatch) setId = setIdMatch[1];
        if (releaseDateMatch) releaseDate = releaseDateMatch[1];
        if (tcgOnlineMatch) ptcgoCode = tcgOnlineMatch[1];
      }

      // Extract other card properties
      const rarityMatch = fileContent.match(/rarity:\s*"([^"]+)"/);
      const categoryMatch = fileContent.match(/category:\s*"([^"]+)"/);
      const hpMatch = fileContent.match(/hp:\s*(\d+)/);
      const stageMatch = fileContent.match(/stage:\s*"([^"]+)"/);

      // Extract types array
      const typesMatch = fileContent.match(/types:\s*\[([\s\S]*?)\]/);
      let types: string[] = [];
      if (typesMatch) {
        types = typesMatch[1].match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, '')) || [];
      }

      // Extract attacks
      const attacks = extractAttacks(fileContent, primaryLang);

      // Extract abilities
      const abilities = extractAbilities(fileContent, primaryLang);

      // Extract weaknesses
      const weaknessesMatch = fileContent.match(/weaknesses:\s*\[([\s\S]*?)\]/);
      let weaknesses: Array<{ type: string; value?: string }> = [];
      if (weaknessesMatch) {
        const weaknessTypeMatch = weaknessesMatch[1].match(/type:\s*"([^"]+)"/);
        const weaknessValueMatch = weaknessesMatch[1].match(/value:\s*"([^"]+)"/);
        if (weaknessTypeMatch) {
          weaknesses.push({
            type: weaknessTypeMatch[1],
            value: weaknessValueMatch ? weaknessValueMatch[1] : undefined
          });
        }
      }

      // Extract resistances
      const resistancesMatch = fileContent.match(/resistances:\s*\[([\s\S]*?)\]/);
      let resistances: Array<{ type: string; value?: string }> = [];
      if (resistancesMatch) {
        const resistanceTypeMatch = resistancesMatch[1].match(/type:\s*"([^"]+)"/);
        const resistanceValueMatch = resistancesMatch[1].match(/value:\s*"([^"]+)"/);
        if (resistanceTypeMatch) {
          resistances.push({
            type: resistanceTypeMatch[1],
            value: resistanceValueMatch ? resistanceValueMatch[1] : undefined
          });
        }
      }

      // Extract retreat cost
      const retreatMatch = fileContent.match(/retreat:\s*(\d+)/);
      let retreatCost: string[] | undefined;
      if (retreatMatch) {
        const retreatNum = parseInt(retreatMatch[1]);
        retreatCost = new Array(retreatNum).fill('Colorless');
      }

      const cardId = `${setId}-${cardNumber}`;

      const card: MultiLangCard = {
        id: cardId,
        names,
        set: setName,
        number: cardNumber,
        setNumber: `${setName} ${cardNumber}`,
        releaseDate: releaseDate.replace(/-/g, '/'),
        series: seriesName,
        supertype: categoryMatch ? categoryMatch[1] : 'Pokemon',
        subtypes: stageMatch ? [stageMatch[1]] : [],
        types,
        ptcgoCode,
        rarity: rarityMatch ? rarityMatch[1] : 'Common',
        hp: hpMatch ? parseInt(hpMatch[1]) : undefined,
        attacks,
        abilities,
        weaknesses: weaknesses.length > 0 ? weaknesses : undefined,
        resistances: resistances.length > 0 ? resistances : undefined,
        retreatCost,
        seriesId,
        setId
      };

      cards.push(card);
      processedCards++;

      if (processedCards % 500 === 0) {
        console.log(`  Processed ${processedCards} cards...`);
      }

    } catch (error) {
      console.error(`  Error processing ${cardFile}:`, error);
      skippedCards++;
    }
  }

  console.log(`  ✅ Processed ${processedCards} cards`);
  console.log(`  ⏭️  Skipped ${skippedCards} non-card files`);

  return cards;
}

/**
 * Main build function
 */
async function buildMultiLanguageData() {
  console.log('Building multi-language card databases...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Build Western database
  const westernCards = await processDirectory(
    WESTERN_DATA_DIR,
    WESTERN_LANGUAGES,
    'en', // Primary language for attack/ability text
    'Western'
  );

  const westernOutputFile = path.join(OUTPUT_DIR, 'cards-western.json');
  fs.writeFileSync(westernOutputFile, JSON.stringify(westernCards), 'utf-8');
  const westernSizeMB = (fs.statSync(westernOutputFile).size / (1024 * 1024)).toFixed(2);
  console.log(`\n📦 Western database: ${westernCards.length} cards, ${westernSizeMB} MB`);
  console.log(`   ${westernOutputFile}`);

  // Build Asian database
  const asianCards = await processDirectory(
    ASIAN_DATA_DIR,
    ASIAN_LANGUAGES,
    'ja', // Primary language for attack/ability text
    'Asian'
  );

  const asianOutputFile = path.join(OUTPUT_DIR, 'cards-asian.json');
  fs.writeFileSync(asianOutputFile, JSON.stringify(asianCards), 'utf-8');
  const asianSizeMB = (fs.statSync(asianOutputFile).size / (1024 * 1024)).toFixed(2);
  console.log(`\n📦 Asian database: ${asianCards.length} cards, ${asianSizeMB} MB`);
  console.log(`   ${asianOutputFile}`);

  console.log('\n✅ Build complete!');
  console.log(`   Total cards: ${westernCards.length + asianCards.length}`);
  console.log(`   Total size: ${(parseFloat(westernSizeMB) + parseFloat(asianSizeMB)).toFixed(2)} MB`);
}

buildMultiLanguageData().catch(error => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
