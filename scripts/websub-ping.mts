#!/usr/bin/env node
import {
  SITE_FEED_PATHS,
  pingWebSubHub,
} from '../lib/indieweb/websub-publisher';

const result = await pingWebSubHub();
console.log(
  `WebSub feeds: ${SITE_FEED_PATHS.length}; hub accepted: ${result.ok}`
);
if (!result.ok) process.exitCode = 1;
