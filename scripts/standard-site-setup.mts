import { runPublishingSetup } from './atproto/setup.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await runPublishingSetup();
