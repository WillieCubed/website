import { runSocialCapture } from '../tests/e2e/publishing/atproto/capture/run.mts';
import { isMain } from '../tests/support/publishing/runtime.mts';

if (isMain(import.meta.url)) await runSocialCapture();
