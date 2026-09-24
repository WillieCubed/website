import { readFileSync } from 'node:fs';

import { parseProjectLink, targetProject } from './targets.mjs';

const link = parseProjectLink(readFileSync(process.argv[2], 'utf8'));
if (!targetProject('website').matches(link)) {
  console.error(
    'This checkout is not linked to the production Vercel project (website).'
  );
  process.exit(1);
}
