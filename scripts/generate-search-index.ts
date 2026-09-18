/**
 * Script to generate the search index at build time.
 * Run with: pnpm exec tsx scripts/generate-search-index.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateSearchIndex } from '../lib/search';

async function main() {
  console.log('Generating search index...');

  const index = await generateSearchIndex();

  const outputPath = join(process.cwd(), 'public', 'search-index.json');
  writeFileSync(outputPath, JSON.stringify(index, null, 2));

  console.log(`Search index generated with ${index.length} items`);
  console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
  console.error('Failed to generate search index:', error);
  process.exit(1);
});
