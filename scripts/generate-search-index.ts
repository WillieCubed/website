import { runSearchIndex } from './search/generate-index.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await runSearchIndex();
