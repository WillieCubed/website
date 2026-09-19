/**
 * Script to generate the search indexes at build time.
 * Run with: pnpm exec tsx scripts/generate-search-index.ts
 *
 * Writes public/search-index.json (the server-rendered /search) and the
 * Pagefind index in public/pagefind/ (the ⌘K modal) from one collection.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateSearchIndex } from '../lib/search';
import { buildPagefindIndex } from '../lib/search/pagefind';

async function main() {
  console.log('Generating search index...');

  const index = await generateSearchIndex();

  const outputPath = join(process.cwd(), 'public', 'search-index.json');
  writeFileSync(outputPath, JSON.stringify(index, null, 2));

  console.log(`Search index generated with ${index.length} items`);
  console.log(`Output: ${outputPath}`);

  const pagefindPath = join(process.cwd(), 'public', 'pagefind');
  await buildPagefindIndex(index, pagefindPath);
  console.log(`Pagefind index written to ${pagefindPath}`);
}

main().catch((error) => {
  console.error('Failed to generate search index:', error);
  process.exit(1);
});
