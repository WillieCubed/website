#!/usr/bin/env node
import { runAuthorBackfill } from './indieweb/webmention/backfill-authors.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await runAuthorBackfill();
