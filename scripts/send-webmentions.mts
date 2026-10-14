#!/usr/bin/env node
import { runWebmentionSend } from './indieweb/webmention/send.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await runWebmentionSend();
