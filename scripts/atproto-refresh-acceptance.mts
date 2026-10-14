import { runRefreshTests } from '../tests/e2e/publishing/atproto/refresh.mts';
import { isMain } from '../tests/support/publishing/runtime.mts';

if (isMain(import.meta.url)) await runRefreshTests();
