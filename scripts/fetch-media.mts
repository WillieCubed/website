import { runMediaFetch } from './media/fetch.mts';
import { isMain } from './shared/command.mts';

export * from './media/fetch.mts';

if (isMain(import.meta.url)) await runMediaFetch();
