import { runMediaBrowserTests } from '../tests/e2e/publishing/indieweb/media-browser.mts';
import { isMain } from '../tests/support/publishing/runtime.mts';

if (isMain(import.meta.url)) await runMediaBrowserTests();
