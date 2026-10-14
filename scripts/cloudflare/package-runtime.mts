import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { isMain } from '../shared/command.mts';

export async function packageCloudflareRuntime() {
  const root = process.cwd();
  const bundle = join(root, '.open-next');
  if (!existsSync(join(bundle, 'worker.js'))) {
    throw new Error(
      'Build the OpenNext Worker before packaging its runtime files.'
    );
  }

  for (const directory of ['content', 'brand/fonts']) {
    cpSync(join(root, directory), join(bundle, directory), { recursive: true });
  }
  mkdirSync(join(bundle, 'public'), { recursive: true });
  cpSync(
    join(root, 'public/search-index.json'),
    join(bundle, 'public/search-index.json')
  );
}

if (isMain(import.meta.url)) await packageCloudflareRuntime();
