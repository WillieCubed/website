import { runHostedResponses } from '../tests/e2e/publishing/atproto/responses/run.mts';
import { isMain } from '../tests/support/publishing/runtime.mts';

if (isMain(import.meta.url)) await runHostedResponses();
