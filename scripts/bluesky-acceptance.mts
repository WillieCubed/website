import { runBlueskyTests } from '../tests/e2e/publishing/atproto/bluesky.mts';
import { isMain } from '../tests/support/publishing/runtime.mts';

if (isMain(import.meta.url)) await runBlueskyTests();
