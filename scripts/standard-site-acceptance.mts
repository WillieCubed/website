import { runStandardSiteAcceptance } from '../tests/e2e/publishing/standard-site/run.mts';
import { isMain } from '../tests/support/publishing/runtime.mts';

if (isMain(import.meta.url)) await runStandardSiteAcceptance();
