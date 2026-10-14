import { runIndieWebAcceptance } from '../tests/e2e/publishing/indieweb/run.mts';
import { isMain } from '../tests/support/publishing/runtime.mts';

if (isMain(import.meta.url)) await runIndieWebAcceptance();
