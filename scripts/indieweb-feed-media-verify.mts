import { runFeedMediaTests } from '../tests/e2e/publishing/indieweb/feed-media.mts';
import { isMain } from '../tests/support/publishing/runtime.mts';

if (isMain(import.meta.url)) await runFeedMediaTests();
