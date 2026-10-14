#!/usr/bin/env node
import { runWebSubPing } from './indieweb/websub/ping.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await runWebSubPing();
