#!/usr/bin/env node
import { runAtprotoSync } from './atproto/sync.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await runAtprotoSync();
