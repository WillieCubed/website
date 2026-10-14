#!/usr/bin/env node
import { runWebmentionModeration } from './indieweb/webmention/moderate.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await runWebmentionModeration();
