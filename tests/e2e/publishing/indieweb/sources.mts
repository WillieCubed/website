import { entrypointPath } from '../../../support/publishing/runtime.mts';

/** Media verification launches the byte and browser checks separately. */
export const indieWebEntrypoints = [
  'indieweb-acceptance.mts',
  'indieweb-feed-media-verify.mts',
  'indieweb-media-browser-verify.mts',
].map(entrypointPath);
