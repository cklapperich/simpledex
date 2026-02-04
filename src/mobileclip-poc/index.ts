#!/usr/bin/env node
import { buildEmbeddings } from './embeddings.js';
import { getImageEmbedding } from './model.js';
import { findSimilar } from './similarity.js';
import { saveEmbeddings, loadEmbeddings, getDefaultStoragePath } from './storage.js';

function printUsage(): void {
  console.log(`
MobileClip-S2 Pokemon Card Similarity POC

Usage:
  tsx src/mobileclip-poc/index.ts --build <image-dir> [--output <path>]
  tsx src/mobileclip-poc/index.ts --search <image-path> [--embeddings <path>] [--top <n>]

Commands:
  --build <dir>       Build embeddings from card images in directory
  --search <image>    Find similar cards to the given image

Options:
  --output <path>     Output path for embeddings JSON (default: ./data/embeddings.json)
  --embeddings <path> Path to embeddings JSON file for search
  --top <n>           Number of similar results to return (default: 5)
  --help              Show this help message

Examples:
  npm run mobileclip:build -- ./pokemon-cards
  npm run mobileclip:search -- ./test-image.jpg --top 10
`);
}

function parseArgs(args: string[]): { command: string; options: Record<string, string> } {
  const options: Record<string, string> = {};
  let command = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--build' && args[i + 1]) {
      command = 'build';
      options.imageDir = args[++i];
    } else if (arg === '--search' && args[i + 1]) {
      command = 'search';
      options.imagePath = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === '--embeddings' && args[i + 1]) {
      options.embeddings = args[++i];
    } else if (arg === '--top' && args[i + 1]) {
      options.top = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      command = 'help';
    }
  }

  return { command, options };
}

async function runBuild(imageDir: string, outputPath?: string): Promise<void> {
  console.log('Building embeddings...\n');

  const database = await buildEmbeddings(imageDir);
  saveEmbeddings(database, outputPath);

  console.log('\nBuild complete!');
}

async function runSearch(
  imagePath: string,
  embeddingsPath?: string,
  topK: number = 5
): Promise<void> {
  console.log(`Searching for similar cards to: ${imagePath}\n`);

  // Load embeddings
  const database = loadEmbeddings(embeddingsPath);

  // Generate embedding for query image
  console.log('\nGenerating embedding for query image...');
  const queryEmbedding = await getImageEmbedding(imagePath);

  // Find similar cards
  console.log(`\nTop ${topK} similar cards:\n`);
  const results = findSimilar(queryEmbedding, database.embeddings, topK);

  results.forEach((result, index) => {
    console.log(`${index + 1}. Card ID: ${result.cardId}`);
    console.log(`   Score: ${result.score.toFixed(4)}`);
    console.log(`   Path: ${result.imagePath}`);
    console.log();
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const { command, options } = parseArgs(args);

  try {
    switch (command) {
      case 'build':
        await runBuild(options.imageDir, options.output);
        break;

      case 'search':
        await runSearch(
          options.imagePath,
          options.embeddings,
          options.top ? parseInt(options.top, 10) : 5
        );
        break;

      case 'help':
        printUsage();
        break;

      default:
        console.error('Unknown command. Use --help for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
