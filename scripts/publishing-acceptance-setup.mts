import { isMain } from '../tests/support/publishing/runtime.mts';
import { runPublishingSetup } from '../tests/support/publishing/setup.mts';

if (isMain(import.meta.url)) await runPublishingSetup();
