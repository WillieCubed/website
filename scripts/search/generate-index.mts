/**
 * Generate both search indexes at build time from one content collection:
 * the serialized index for server-rendered search and the Pagefind assets
 * for the command palette. Run with `pnpm search:index`.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateSearchIndex } from '../../lib/search/index';
import { buildPagefindIndex } from '../../lib/search/pagefind';
import { isMain } from '../shared/command.mts';

export async function runSearchIndex() {
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

  await main().catch((error) => {
    console.error('Failed to generate search index:', error);
    process.exit(1);
  });
}

if (isMain(import.meta.url)) await runSearchIndex();
