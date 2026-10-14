import { runSocialTests } from '../tests/e2e/publishing/atproto/social.mts';
import { isMain } from '../tests/support/publishing/runtime.mts';

if (isMain(import.meta.url)) await runSocialTests();
